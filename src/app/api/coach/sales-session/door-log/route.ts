import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { createSignedUploadTarget } from "@/lib/storage/assets";
import { createKnock, createPitch } from "@/lib/data/doorlog";
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
    if (!target.ok) return NextResponse.json({ error: target.error }, { status: 502 });
    return NextResponse.json({ storagePath: target.storagePath, token: target.token });
  }

  // Both knock + pitch create a knock first (idempotent on client_knock_id).
  const knock = await createKnock({
    companyId,
    outcome: body.outcome,
    localDate: body.localDate,
    clientKnockId: body.clientKnockId ?? null,
  });
  if (!knock) {
    // A duplicate client_knock_id (offline retry) is a SUCCESS from the rep's view — the knock already landed.
    return NextResponse.json({ ok: true, deduped: true });
  }

  if (body.kind === "knock") {
    return NextResponse.json({ ok: true, knockId: knock.id });
  }

  // Pitch: create the pitch row pointing at the uploaded audio, then kick the worker fire-and-forget.
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
