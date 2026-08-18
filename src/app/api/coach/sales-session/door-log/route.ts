import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { createSignedUploadTarget } from "@/lib/storage/assets";
import { createKnock, createPitch, getKpiForDay } from "@/lib/data/doorlog";
import { processPitch } from "@/lib/coach/doorlog/worker";

/**
 * POST /api/coach/sales-session/door-log — the Door Log's write endpoint (Macro Mode).
 *
 * Three shapes, all optimistic / non-blocking for the rep (build-spec 2.1/3.3):
 *  - { kind: "knock" }  — log a No-Answer (or any outcome) knock; returns immediately.
 *  - { kind: "sign" }   — mint a signed upload target so the browser uploads pitch audio DIRECT to storage
 *                         (bypasses the ~4.5 MB Vercel body cap).
 *  - { kind: "pitch" }  — after the audio is uploaded, create the knock + pitch and KICK the worker
 *                         fire-and-forget (after()). The rep is back on IDLE before any processing runs.
 *
 * Idempotent on client_knock_id (offline queue may retry). LLM/STT never runs in this request.
 */

const KnockBody = z.object({
  kind: z.literal("knock"),
  outcome: z.enum(["no_answer", "sold", "go_back", "non_decision_maker", "not_interested"]),
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  clientKnockId: z.string().max(100).optional(),
});
const SignBody = z.object({ kind: z.literal("sign") });
const PitchBody = z.object({
  kind: z.literal("pitch"),
  outcome: z.enum(["sold", "go_back", "non_decision_maker", "not_interested"]),
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  clientKnockId: z.string().max(100).optional(),
  name: z.string().min(1).max(200),
  durationMs: z.number().int().nonnegative().max(3_600_000).nullable().optional(),
  storagePath: z.string().max(400),
});
const Body = z.discriminatedUnion("kind", [KnockBody, SignBody, PitchBody]);

// Kicks the worker via after(), which awaits an LLM/STT chain — needs headroom beyond Vercel's short default.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "door-log-write", windowMs: 60_000, max: 120 });
  if (limited) return limited;

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const companyId = (await getCurrentCompanyId()) ?? undefined;
  if (!companyId) return NextResponse.json({ error: "No company context." }, { status: 403 });

  if (body.kind === "sign") {
    const target = await createSignedUploadTarget({
      companyId,
      fileId: randomUUID(),
      originalFilename: "pitch.webm",
    });
    if (!target.ok) {
      // F7 (CWE-209): don't return the raw storage exception to the client; log it, send a generic message.
      console.error("[door-log] signed-upload target failed:", target.error);
      return NextResponse.json({ error: "Couldn't prepare the audio upload. Try again." }, { status: 502 });
    }
    return NextResponse.json({ storagePath: target.storagePath, token: target.token });
  }

  // F3: bind the client-echoed storagePath to the caller's company — the worker downloads it via the
  // service-role client (bypasses storage RLS), so an unvalidated path is a client-controlled read.
  if (body.kind === "pitch" && body.storagePath && !body.storagePath.startsWith(`${companyId}/`)) {
    return NextResponse.json({ error: "Invalid audio path." }, { status: 400 });
  }

  // Both knock + pitch create a knock first (idempotent on client_knock_id). createKnock returns the id
  // even on a dedupe (F1), so a null here is a REAL failure — not the offline-retry case.
  const knock = await createKnock({
    companyId,
    outcome: body.outcome,
    localDate: body.localDate,
    clientKnockId: body.clientKnockId ?? null,
  });
  if (!knock) {
    return NextResponse.json({ error: "Could not log the knock." }, { status: 500 });
  }

  if (body.kind === "knock") {
    return NextResponse.json({ ok: true, knockId: knock.id, deduped: knock.deduped ?? false });
  }

  // Pitch: create the pitch row (idempotent on knock_id, F1) — proceed EVEN IF the knock deduped, so a
  // partial-failure retry (knock-yes/pitch-no) still lands the pitch. Then kick the worker fire-and-forget.
  const pitch = await createPitch({
    knockId: knock.id,
    companyId,
    name: body.name,
    audioPath: body.storagePath,
    durationMs: body.durationMs ?? null,
  });
  if (!pitch) return NextResponse.json({ error: "Could not create the pitch." }, { status: 500 });

  const repId = auth.user.id;
  // Fire-and-forget: the rep is already back on IDLE; the cron is the durable backstop if this is dropped.
  after(() =>
    processPitch({
      id: pitch.id,
      company_id: companyId,
      rep_id: repId,
      audio_path: body.storagePath,
      status: "uploading",
      attempts: 0,
    })
  );

  return NextResponse.json({ ok: true, knockId: knock.id, pitchId: pitch.id });
}

/**
 * GET /api/coach/sales-session/door-log?date=YYYY-MM-DD — the rep's KPI strip for a local sales day
 * (RLS-scoped: a rep sees only their own; the view aggregates door_knocks). Best-effort; the Door Log
 * never blocks on it.
 */
export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const date = req.nextUrl.searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Missing/invalid date." }, { status: 400 });
  }
  const rows = await getKpiForDay(date);
  // The rep's own row (RLS returns only theirs); sum defensively in case of multiple.
  const total = rows.reduce(
    (acc, r) => ({
      doorsKnocked: acc.doorsKnocked + Number(r.doors_knocked ?? 0),
      sold: acc.sold + Number(r.sold ?? 0),
      goBacks: acc.goBacks + Number(r.go_backs ?? 0),
      notInterested: acc.notInterested + Number(r.not_interested ?? 0),
    }),
    { doorsKnocked: 0, sold: 0, goBacks: 0, notInterested: 0 }
  );
  return NextResponse.json(total);
}
