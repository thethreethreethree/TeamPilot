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

/**
 * GET /api/coach/sales-session/skills — the rep's PERSONAL skill analytics (ELOSTATE
 * spec p3). Six skills scored /10 across their recent sessions, each with a short AI
 * breakdown. "All about the user — when they come home and want to learn from their
 * day." No team aggregate, no ELO number: this endpoint is the rep's own mirror only.
 *
 * The scores are the rep's PRIVATE self-assessment (A18), so this returns ONLY the
 * caller's own skills — agent_id is always auth.uid(), never a parameter. A manager
 * cannot read a named rep's skill breakdown here; that stays a mirror for the rep.
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
    .select("company_id")
    .eq("id", auth.user.id)
    .maybeSingle();
  const companyId = profile?.company_id as string | undefined;

  const recent = await getRecentAfterPitchSummariesAdmin(auth.user.id, MAX_SESSIONS);
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
