import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import {
  getRecentAfterPitchSummariesAdmin,
  getSessionTranscriptAdmin,
} from "@/lib/data/salesCoach";
import { dissectCoachV5 } from "@/lib/claude";
import {
  aggregateSkills,
  agentWpm,
  parseBreakdownLines,
  mergeBreakdowns,
  type SkillScore,
  type SkillBreakdown,
} from "@/lib/coach/v5/skillAnalytics";
import type { ScoreCategory } from "@/lib/coach/v5/summaryTypes";
import { isSalesCoachManager, canManagerViewRepSkills } from "@/lib/coach/v5/skillAccess";

/**
 * GET /api/coach/sales-session/skills[?agentId=<rep>] — six skills scored /10 across recent
 * sessions, each with a short AI breakdown.
 *
 * DEFAULT (no agentId, or agentId = caller): the rep's OWN mirror — unchanged from the original
 * self-only behavior. Every existing caller keeps identical output.
 *
 * MANAGER READ (agentId != caller): the ELOSALES Standard revision (PDF Analytics §B) opens this
 * to managers so they can see what a rep is doing well / where they need coaching. This DELIBERATELY
 * crosses the original self-only §A18 boundary — done under the framework:
 *   - Gate: caller must be a MANAGER (sales_coach_role='admin' OR company role CEO/COO/admin) in the
 *     SAME company as the target rep. Non-managers and cross-company callers are refused.
 *   - A10 (no shadow read): the data returned to a manager for rep X is the IDENTICAL computation the
 *     rep sees in their own self-view — same endpoint, same numbers. The rep is never shown less than
 *     their manager sees about them.
 *   - A18 (label is the defense): the numbers are labeled as growth areas / strengths in the UI
 *     (coaching framing), never as a rank. The route returns the scores; the coaching framing is the
 *     surface's job (Layer 4).
 */

// Bound the transcript fetches (speed-of-speech needs the raw turns). The score
// average is stable well before 10 sessions; more would be heavier for no signal.
const MAX_SESSIONS = 10;

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "coach-skills", windowMs: 60_000, max: 30 });
  if (limited) return limited;

  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const { data: profile } = await sb
    .from("profiles")
    .select("company_id, role, sales_coach_role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const companyId = profile?.company_id as string | undefined;

  // Resolve WHOSE skills to read. Default: the caller's own (self-mirror, unchanged — A10).
  const requestedAgentId = new URL(req.url).searchParams.get("agentId");
  let targetAgentId = auth.user.id;
  if (requestedAgentId && requestedAgentId !== auth.user.id) {
    // Manager reading a named rep — crosses the former self-only §A18 gate, done under the framework
    // via the pure, tested authz decision (src/lib/coach/v5/skillAccess.ts).
    const caller = {
      role: profile?.role ?? null,
      sales_coach_role: profile?.sales_coach_role ?? null,
      company_id: companyId ?? null,
    };
    if (!isSalesCoachManager(caller)) {
      return NextResponse.json(
        { error: "Only a manager can view a rep's skill profile." },
        { status: 403 }
      );
    }
    // The RLS user client can only read a same-company profile, so a cross-company id returns null.
    const { data: target } = await sb
      .from("profiles")
      .select("company_id")
      .eq("id", requestedAgentId)
      .maybeSingle();
    const decision = canManagerViewRepSkills(caller, target ?? null);
    if (!decision.ok) {
      return NextResponse.json({ error: "Rep not found in your team." }, { status: 404 });
    }
    targetAgentId = requestedAgentId;
  }

  const recent = await getRecentAfterPitchSummariesAdmin(targetAgentId, MAX_SESSIONS);
  if (recent.length === 0) {
    // Honest empty state (§3.4): no sessions yet is not a zero score.
    return NextResponse.json({ skills: [], sampleSessions: 0 });
  }

  // Per-session score cards from each stored summary payload.
  const perSession: ScoreCategory[][] = recent.map((r) => {
    const p = r.payload as { scores?: unknown } | null;
    return Array.isArray(p?.scores) ? (p!.scores as ScoreCategory[]) : [];
  });

  // Per-session agent words-per-minute (null where a session has no timing).
  const wpms = await Promise.all(
    recent.map(async (r) => {
      try {
        const segs = await getSessionTranscriptAdmin(r.sessionId);
        return agentWpm(segs);
      } catch {
        return null;
      }
    })
  );

  const skills = aggregateSkills(perSession, wpms);

  // ONE cached LLM pass for the breakdowns (founder-confirmed): a single call names
  // the one short thing behind each scored skill. Degrades to the deterministic band
  // read if the model is unavailable or malformed — §3.4 degrade, never fabricate.
  const withBreakdowns = await addBreakdowns(skills, companyId);

  return NextResponse.json({
    skills: withBreakdowns,
    sampleSessions: recent.length,
  });
}

async function addBreakdowns(
  skills: SkillScore[],
  companyId: string | undefined
): Promise<SkillBreakdown[]> {
  // Degrade path (§3.4): no company / no scored skills / any failure below → each
  // skill keeps its deterministic read. mergeBreakdowns with an empty map yields
  // exactly that, so the fallback and the success path share one honest merge.
  const fallback = (): SkillBreakdown[] => mergeBreakdowns(skills, new Map());

  // Only skills we actually scored get an AI line; a null-score skill keeps its
  // honest "not enough yet" read (nothing to explain).
  const scored = skills.filter((s) => s.score !== null);
  if (!companyId || scored.length === 0) return fallback();

  const list = scored
    .map((s) => `- ${s.label}: ${s.score}/10`)
    .join("\n");

  const systemPrompt = `You write ONE short coaching line per sales skill, for a rep
reviewing their own recent-calls scorecard. Rules:
- One sentence per skill. Plain, direct, specific to the score. NO preamble, no fluff.
- A low score names the fix; a high score says what to keep doing. Never generic praise.
- Do NOT invent specifics about calls you can't see — coach to the score band only.
- Output ONLY JSON: { "lines": [ { "label": "<exact label>", "line": "<one sentence>" } ] }`;

  const userMessage = `The rep's skills, scored out of 10 across their recent sessions:
${list}

Write one short line for each. JSON only.`;

  try {
    const r = await dissectCoachV5({ companyId, systemPrompt, userMessage });
    if (r.suppressed) return fallback();
    // Pure parse + merge (unit-tested in skillAnalytics): a null-score skill can
    // never receive an AI line, and a malformed response degrades to reads.
    return mergeBreakdowns(skills, parseBreakdownLines(r.text));
  } catch {
    return fallback();
  }
}
