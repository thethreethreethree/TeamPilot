import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { createSignedUploadTarget } from "@/lib/storage/assets";
import { createKnock, createPitch, getKpiForDay, getAllTimeKpi } from "@/lib/data/doorlog";
import { processPitch } from "@/lib/coach/doorlog/worker";
import { pitchRecordingPath } from "@/lib/coach/doorlog/pitchAudioChunks";

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
// mimeType: the recorded blob's actual type, so the stored file gets the RIGHT extension. iOS now records mp4 (not
// webm) — naming an mp4 blob "pitch.webm" can misparse in transcription. Optional (an older client omits it → webm).
const SignBody = z.object({ kind: z.literal("sign"), mimeType: z.string().max(120).optional() });

// Map a recorder mimeType to a storage filename extension. Defaults to webm (the non-iOS pipeline format).
export function extForMime(mime?: string): string {
  const m = (mime ?? "").toLowerCase();
  if (m.includes("mp4") || m.includes("m4a") || m.includes("aac")) return "mp4";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("ogg")) return "ogg";
  return "webm";
}
const PitchBody = z.object({
  kind: z.literal("pitch"),
  outcome: z.enum(["sold", "go_back", "non_decision_maker", "not_interested"]),
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  clientKnockId: z.string().max(100).optional(),
  name: z.string().min(1).max(200),
  durationMs: z.number().int().nonnegative().max(3_600_000).nullable().optional(),
  // Audio arrives one of two ways: `recordingId` (the durable path — chunks uploaded DURING recording, the
  // server stitches them) OR `storagePath` (the single-blob fallback). Exactly one is expected; both optional
  // in the schema so a degraded client that has neither still gets an honest 400 rather than a hard parse fail.
  // min(1) (audit M3): a present-but-EMPTY storagePath is a client contract violation, not a valid path — reject
  // it at the schema boundary so it can never mint a pitch with an empty audio_path (a doomed worker claim).
  storagePath: z.string().min(1).max(400).optional(),
  recordingId: z.string().regex(/^[a-zA-Z0-9-]{8,64}$/).optional(),
});
const Body = z.discriminatedUnion("kind", [KnockBody, SignBody, PitchBody]);

// Kicks the worker via after(), which awaits the FULL STT + LLM chain. 60s was too little — a long recording's
// chain exceeds it, the after() is killed mid-processing, and the pitch then waits out its ~5-min claim lease before
// the cron re-claims it (2026-08-25 latency audit — the tail that inflated the after-pitch feedback average).
// Aligned to 300s = the pitch-processing-cron's OWN budget so the kick finishes inline. The claim lease still
// prevents double-processing if it ever does hand off to the cron.
export const maxDuration = 300;

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
      // Extension reflects the ACTUAL recorded format (iOS records mp4, not webm) so transcription parses it right.
      originalFilename: `pitch.${extForMime(body.mimeType)}`,
    });
    if (!target.ok) {
      // F7 (CWE-209): don't return the raw storage exception to the client; log it, send a generic message.
      console.error("[door-log] signed-upload target failed:", target.error);
      return NextResponse.json({ error: "Couldn't prepare the audio upload. Try again." }, { status: 502 });
    }
    return NextResponse.json({ storagePath: target.storagePath, token: target.token });
  }

  // Resolve the pitch's audio path SERVER-SIDE:
  //  • recordingId → the stitched-recording path derived from the caller's company (the worker stitches the
  //    incrementally-uploaded chunks into it). Path is computed here, never taken from the client, so there is
  //    no client-controlled read.
  //  • storagePath (single-blob fallback) → validate it is scoped to the caller's company (F3) before the
  //    service-role worker downloads it.
  let pitchAudioPath = "";
  if (body.kind === "pitch") {
    if (body.recordingId) {
      pitchAudioPath = pitchRecordingPath(companyId, body.recordingId);
    } else if (body.storagePath) {
      if (!body.storagePath.startsWith(`${companyId}/`)) {
        return NextResponse.json({ error: "Invalid audio path." }, { status: 400 });
      }
      pitchAudioPath = body.storagePath;
    } else {
      // Neither audio reference — the client sends a knock instead when there is no audio, so this is a bad body.
      return NextResponse.json({ error: "A pitch requires audio." }, { status: 400 });
    }
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
    audioPath: pitchAudioPath,
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
      audio_path: pitchAudioPath,
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

  // All-time totals for the dashboard's Macro Mode bubbles (Doors Knocked / Presentation / Sold).
  if (req.nextUrl.searchParams.get("range") === "all") {
    return NextResponse.json(await getAllTimeKpi(auth.user.id));
  }

  const date = req.nextUrl.searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Missing/invalid date." }, { status: 400 });
  }
  let rows: Awaited<ReturnType<typeof getKpiForDay>>;
  try {
    rows = await getKpiForDay(date, auth.user.id);
  } catch (e) {
    // Audit L1: a KPI read error returns a 5xx, NOT a fabricated 0 strip. Generic message (CWE-209); the client's
    // best-effort loadKpi keeps its last good values instead of blanking to zeros.
    console.error(`[door-log kpi] read failed: ${e instanceof Error ? e.message : String(e)}`);
    return NextResponse.json({ error: "Couldn't load your stats right now — please try again." }, { status: 502 });
  }
  // The caller's own row (now pinned to rep_id — a manager would otherwise sum the whole team via RLS);
  // sum defensively in case of multiple.
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
