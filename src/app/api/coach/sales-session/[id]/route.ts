import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { readBody } from "@/lib/api/validate";
import {
  getSession,
  getSessionTranscript,
  setSessionStatus,
  renameSession,
} from "@/lib/data/salesCoach";

/**
 * Live Sales Coach — single session.
 *
 * GET   → the session + its full diarized transcript (RLS-scoped).
 * PATCH → forward-only status change ('ended' | 'reviewed'),
 *         optionally attaching the stored audio asset pointer.
 */

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = callerScopedDb(req) ?? (await createClient());
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const session = await getSession(id);
  if (!session) {
    return NextResponse.json(
      { error: "Session not found or not accessible." },
      { status: 404 }
    );
  }
  const transcript = await getSessionTranscript(id);
  return NextResponse.json({ session, transcript });
}

// A PATCH is EITHER a forward-only status change OR a rename (spec 1b: name the
// session after recording). status is now optional so a pure rename doesn't have
// to fake a transition; the refine guarantees at least one real change.
const PatchSchema = z
  .object({
    status: z.enum(["ended", "reviewed"]).optional(),
    // NOTE: no audioAssetUrl here. The audio pointer is written ONLY by the
    // upload-recording route, in the bucket-relative `${ASSETS_BUCKET}/…` shape
    // the retention cron can purge. This field used to accept a full `z.url()`
    // — the exact shape the recording-purge cron flags `malformed` and never
    // deletes — so a caller setting it would have silently created audio that
    // survives past the 2-day retention promise. It was unused (no caller sent
    // it); removed so the write boundary can only ever store a purgeable shape
    // (§3.4 — don't accept data you can't honor the deletion promise on). If a
    // PATCH-sets-audio flow is ever wanted, it must take the storage PATH, not
    // a URL, so it stays purgeable.
    clientLabel: z.string().trim().min(1).max(120).optional(),
  })
  .refine((b) => b.status !== undefined || b.clientLabel !== undefined, {
    message: "Nothing to update — provide a status or a new label.",
  });

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = await readBody(req, PatchSchema);
  if (body instanceof NextResponse) return body;

  const supabase = callerScopedDb(req) ?? (await createClient());
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  // RLS-scoped read gates access: a user can only see sessions in their
  // own company, so a successful getSession authorizes the transition.
  const existing = await getSession(id);
  if (!existing) {
    return NextResponse.json(
      { error: "Session not found or not accessible." },
      { status: 404 }
    );
  }

  // Rename first (spec 1b), then any status change — so a single PATCH that both
  // renames and ends works, and a pure rename never touches the lifecycle.
  let updated = existing;
  if (body.clientLabel !== undefined) {
    // AUTHZ (audit 2026-07-15): getSession is company-scoped (a member sees any
    // session in their company), which is the right bar for a status transition a
    // manager may make — but NOT for a rename. Renaming is "name YOUR call", so a
    // rename must be OWNER-ONLY, or any company member could relabel a colleague's
    // session via a direct API call (the UI already only offers it to the owner;
    // this closes the same gap at the API, where the UI guard can't reach).
    if (existing.agentId !== auth.user.id) {
      return NextResponse.json(
        { error: "Only the session's owner can rename it." },
        { status: 403 }
      );
    }
    const renamed = await renameSession(id, body.clientLabel);
    if (!renamed) {
      return NextResponse.json({ error: "Couldn't rename the session." }, { status: 500 });
    }
    updated = renamed;
  }
  if (body.status !== undefined) {
    const transitioned = await setSessionStatus({
      sessionId: id,
      status: body.status,
    });
    if (!transitioned) {
      return NextResponse.json(
        { error: "Couldn't update the session." },
        { status: 500 }
      );
    }
    updated = transitioned;
  }
  return NextResponse.json({ session: updated });
}
