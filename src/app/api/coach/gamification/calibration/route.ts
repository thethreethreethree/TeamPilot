import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { z } from "zod";
import type { ScoreCategory } from "@/lib/coach/v5/summaryTypes";
import {
  computeCalibration,
  JUDGED_DIMENSIONS,
  type CalibrationPair,
  type DimScores,
  type JudgedDimension,
} from "@/lib/coach/gamification/calibration";

/**
 * Gamification Phase 6 — the calibration tool (manager-only).
 *   GET  → the calibration REPORT so far (human vs model agreement per dimension) + the NEXT transcript to score.
 *          The transcript is ANONYMIZED (no rep name) — a manager calibrates the SCORER, never sees "rep X scored
 *          low" (preserves the A18 privacy model). The model's scores are withheld until after the blind submit.
 *   POST → store this manager's blind scores for a session, then REVEAL the model's judged scores for comparison.
 * Service-role throughout (it reads rep-private after_pitch scores for the comparison), gated by a manager check.
 */

/** Pull the model's judged 0-10 dimension scores out of an after_pitch payload. */
function modelScores(payload: unknown): DimScores {
  const scores = (payload as { scores?: ScoreCategory[] } | null)?.scores ?? [];
  const out: DimScores = {};
  for (const c of scores) {
    if ((JUDGED_DIMENSIONS as readonly string[]).includes(c.key) && typeof c.score === "number") {
      out[c.key as JudgedDimension] = c.score;
    }
  }
  return out;
}

async function requireManager(req: NextRequest): Promise<{ userId: string; companyId: string } | null> {
  const ctx = await resolveApiAuth(req); // web cookie OR mobile Bearer
  if (!ctx) return null;
  // Manager = a company admin (ctx.isAdmin) OR sales_coach_role='admin' — the same predicate the coaching RLS uses.
  if (ctx.isAdmin) return { userId: ctx.userId, companyId: ctx.companyId };
  const admin = createAdminClient();
  const { data: p } = await admin.from("profiles").select("sales_coach_role").eq("id", ctx.userId).maybeSingle();
  return p?.sales_coach_role === "admin" ? { userId: ctx.userId, companyId: ctx.companyId } : null;
}

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "gamification-calibration-get", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const mgr = await requireManager(req);
  if (!mgr) return NextResponse.json({ error: "Managers only." }, { status: 403 });

  const admin = createAdminClient();
  // 1) Sessions in the company that HAVE model scores (an after_pitch) — the calibration pool.
  const { data: aps } = await admin
    .from("after_pitch_summaries")
    .select("session_id, payload")
    .eq("company_id", mgr.companyId)
    .limit(500);
  const modelBySession = new Map<string, DimScores>();
  for (const a of aps ?? []) {
    const m = modelScores(a.payload);
    if (Object.keys(m).length > 0 && !modelBySession.has(String(a.session_id))) {
      modelBySession.set(String(a.session_id), m);
    }
  }

  // 2) This manager's blind scores so far.
  const { data: cal } = await admin
    .from("gamification_calibration")
    .select("session_id, scores")
    .eq("company_id", mgr.companyId)
    .eq("scorer_id", mgr.userId);
  const humanBySession = new Map<string, DimScores>();
  for (const c of cal ?? []) humanBySession.set(String(c.session_id), (c.scores ?? {}) as DimScores);

  // 3) The report — pairs where this manager has scored AND the model has.
  const pairs: CalibrationPair[] = [];
  for (const [sessionId, human] of humanBySession) {
    const model = modelBySession.get(sessionId);
    if (model) pairs.push({ sessionId, human, model });
  }
  const report = computeCalibration(pairs);

  // 4) The NEXT transcript to score — a pooled session this manager hasn't scored, with a persisted transcript.
  let next: { sessionId: string; transcript: string } | null = null;
  for (const sessionId of modelBySession.keys()) {
    if (humanBySession.has(sessionId)) continue;
    const { data: segs } = await admin
      .from("coaching_transcript_segments")
      .select("speaker, text, seq")
      .eq("session_id", sessionId)
      .order("seq", { ascending: true });
    if (segs && segs.length >= 4) {
      // ANONYMIZED: speaker role only (agent/customer), never the rep's name.
      const transcript = segs
        .map((s) => `${s.speaker === "agent" ? "REP" : s.speaker === "customer" ? "PROSPECT" : "?"}: ${String(s.text).replace(/\s+/g, " ").trim()}`)
        .join("\n");
      next = { sessionId, transcript };
      break;
    }
  }

  return NextResponse.json({ report, scored: humanBySession.size, pool: modelBySession.size, next });
}

const SubmitBody = z.object({
  sessionId: z.string().uuid(),
  scores: z.object({
    opener: z.number().int().min(0).max(10),
    objection: z.number().int().min(0).max(10),
    tone: z.number().int().min(0).max(10),
    close: z.number().int().min(0).max(10),
    next_step: z.number().int().min(0).max(10),
  }),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "gamification-calibration-post", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const mgr = await requireManager(req);
  if (!mgr) return NextResponse.json({ error: "Managers only." }, { status: 403 });
  const body = await readBody(req, SubmitBody);
  if (body instanceof NextResponse) return body;

  const admin = createAdminClient();
  // Store the blind score (idempotent per manager+session via the unique index).
  const { error } = await admin
    .from("gamification_calibration")
    .upsert(
      { company_id: mgr.companyId, session_id: body.sessionId, scorer_id: mgr.userId, scores: body.scores },
      { onConflict: "scorer_id,session_id", ignoreDuplicates: true },
    );
  if (error) {
    // eslint-disable-next-line no-console
    console.error("[gamification-calibration] submit error:", error.message);
    return NextResponse.json({ error: "Couldn't save your score." }, { status: 500 });
  }

  // REVEAL: the model's judged scores for this session, so the manager sees the comparison.
  const { data: ap } = await admin
    .from("after_pitch_summaries")
    .select("payload")
    .eq("session_id", body.sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return NextResponse.json({ ok: true, model: modelScores(ap?.payload), human: body.scores });
}
