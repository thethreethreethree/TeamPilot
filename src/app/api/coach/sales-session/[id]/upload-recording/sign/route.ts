import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { getSession } from "@/lib/data/salesCoach";
import { isSalesCoachManager } from "@/lib/coach/v5/skillAccess";
import {
  createSignedUploadTarget,
  AGENT_MAX_BYTES,
  ASSETS_BUCKET,
  EXECUTABLE_EXTENSIONS,
} from "@/lib/storage/assets";

/**
 * POST /api/coach/sales-session/[id]/upload-recording/sign
 *
 * Mints a SIGNED UPLOAD target so the browser can upload the call recording
 * DIRECT to Storage, bypassing the ~4.5 MB Vercel serverless request-body limit
 * (src/lib/storage/assets.ts:307) that silently killed every real phone
 * recording routed through the multipart /upload-recording path. A 10-min Voice
 * Memo (.m4a) is ~5 MB; a 30-min call ~25 MB — all impossible through the
 * function body, all fine straight to Storage. The client then uploads via the
 * token and POSTs { storagePath } to /upload-recording (JSON branch), which
 * transcribes from storage.
 *
 * We validate MANUALLY here (size + audio/video MIME + executable-ext block)
 * rather than via validateUploadCandidate — that helper's BLOCKED_EXTENSIONS
 * rejects .webm/.mp4, which are legitimate recording formats (the sibling
 * /upload-recording route documents the same reason). The bucket's own 25 MB
 * ceiling + the finalize step's getAssetObjectInfo re-check are the authoritative
 * gates; the sizeBytes check here is a fast client-side-claimed fail.
 */
const Body = z.object({
  filename: z.string().min(1).max(400),
  sizeBytes: z.number().int().nonnegative(),
  mimeType: z.string().max(200).optional(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req, {
    id: "sales-session-upload-sign",
    windowMs: 60_000,
    max: 20,
  });
  if (limited) return limited;

  const { id } = await context.params;
  // ONE substitution: the client. A mobile caller's client carries their own
  // JWT, so auth.getUser(), the profiles read and the RLS-scoped getSession
  // below all behave exactly as they do for a cookie caller — no second auth
  // path, no duplicated ownership rule, and every existing test still describes
  // the real behaviour. A web request gets the cookie client as before.
  const scoped = callerScopedDb(req);
  const supabase = scoped ?? (await createClient());
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  // getCurrentCompanyId builds its OWN cookie client, so it is null for a
  // mobile caller. Fall back to the company on the caller's own profile row,
  // read through their scoped client — the same value by the same rules.
  const companyId =
    (await getCurrentCompanyId()) ??
    ((
      await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", auth?.user?.id ?? "")
        .maybeSingle()
    ).data?.company_id as string | undefined) ??
    undefined;
  if (!companyId) {
    return NextResponse.json({ error: "No company context." }, { status: 403 });
  }

  // RLS-scoped read authorizes company access to this session.
  const session = await getSession(id, scoped ?? undefined);
  if (!session) {
    return NextResponse.json(
      { error: "Session not found or not accessible." },
      { status: 404 }
    );
  }

  // INV19: getSession is COMPANY-scoped, not owner-scoped. Uploading a recording
  // writes to (and, on finalize, exposes) the call's content, so gate it to the
  // session's OWNER or a Sales Coach MANAGER — a colleague sharing the company must
  // not attach/pull another rep's call. Mirrors /retranscribe's owner gate.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, sales_coach_role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const isManager = isSalesCoachManager({
    role: (profile?.role as string | null) ?? null,
    sales_coach_role: (profile?.sales_coach_role as string | null) ?? null,
    company_id: null,
  });
  if (session.agentId !== auth.user.id && !isManager) {
    return NextResponse.json(
      { error: "You can only upload a recording to your own sessions." },
      { status: 403 }
    );
  }

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  if (body.sizeBytes === 0) {
    return NextResponse.json({ error: "Empty recording." }, { status: 400 });
  }
  if (body.sizeBytes > AGENT_MAX_BYTES) {
    return NextResponse.json(
      {
        error: `Recording too large (max ${Math.floor(
          AGENT_MAX_BYTES / 1024 / 1024
        )}MB).`,
      },
      { status: 413 }
    );
  }
  // Empty MIME is common when a voice memo is picked from the Files app on mobile —
  // default it to audio so extension-only picks still pass (the finalize step re-checks
  // the real stored content-type). Accept audio/* and video/* (some phones tag a .3gp
  // voice memo as video/3gpp).
  const mimeType = body.mimeType?.trim() || "audio/webm";
  if (!mimeType.startsWith("audio/") && !mimeType.startsWith("video/")) {
    return NextResponse.json(
      { error: "Please upload an audio (or video) recording." },
      { status: 400 }
    );
  }
  // Defense-in-depth: the browser MIME is spoofable, so refuse a dangerous executable
  // EXTENSION regardless (matches the multipart branch).
  const lowerName = body.filename.toLowerCase();
  if (EXECUTABLE_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
    return NextResponse.json(
      { error: "That file type isn't allowed." },
      { status: 400 }
    );
  }

  const target = await createSignedUploadTarget({
    companyId,
    fileId: randomUUID(),
    originalFilename: body.filename,
  });
  if (!target.ok) {
    // Log the raw cause; return a generic message (audit F6 / CWE-209 — don't echo the backend string).
    console.error(`[upload-recording/sign] target mint failed session=${id}: ${target.error}`);
    return NextResponse.json(
      { error: "Couldn't start the upload right now — please try again in a moment." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    bucket: ASSETS_BUCKET,
    storagePath: target.storagePath,
    token: target.token,
  });
}
