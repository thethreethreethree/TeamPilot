import "server-only";
import { dissectCoachV5 } from "@/lib/claude";
import {
  getCurrentSalesCorpus,
  type TranscriptSegment,
  type SalesContext,
} from "@/lib/data/salesCoach";
import {
  buildSalesScoreSystemPrompt,
  buildSalesScoreUserMessage,
} from "./salesScorePrompt";

/**
 * After Pitch Summary — RUBRIC SCORER engine (private self-assessment).
 *
 * Two kinds of category, split by measurability (the founder-approved honest
 * design 2026-07-02):
 *   - talk_ratio  → COMPUTED from the transcript (agent vs customer word
 *     share). Hard data, `computed: true`, no citation, no LLM guess.
 *   - opener / objection / tone / close → graded by the LLM against the
 *     methodology corpus, each with a mandatory rationale + transcript
 *     citation (A11 — never a naked number).
 *
 * Private to the rep (A18) — the surface + RLS enforce that; this engine just
 * produces the numbers. Never throws; thin/failed input → honest empty state.
 */

export type ScoreKey = "opener" | "objection" | "talk_ratio" | "tone" | "close";

export type ScoreCategory = {
  key: ScoreKey;
  label: string;
  /** 0-10 for graded categories; for talk_ratio this is the rep's talk share
   *  as a 0-10 (agentShare*10) so the strip renders uniformly — but `display`
   *  is the honest ratio and `computed` marks it as hard data. */
  score: number;
  /** What the rep reads: "8/10" for graded; "62 / 38" for talk ratio. */
  display: string;
  rationale: string;
  /** Transcript moment the score is grounded in; null for computed talk_ratio. */
  citation: string | null;
  /** True = deterministic (talk_ratio); false = corpus-graded assessment. */
  computed: boolean;
};

export type SalesScores = {
  hasSignal: boolean;
  categories: ScoreCategory[];
};

const EMPTY: SalesScores = { hasSignal: false, categories: [] };

const MIN_AGENT_SEGMENTS = 3; // same bar as the growth review

const LABELS: Record<ScoreKey, string> = {
  opener: "Opener",
  objection: "Objection",
  talk_ratio: "Talk / Listen",
  tone: "Tone",
  close: "Close",
};

function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Deterministic talk ratio (hard data). Returns rep vs customer share as
 *  whole-number percents that sum to 100, plus a plain-language read. */
function computeTalkRatio(
  segments: TranscriptSegment[]
): ScoreCategory | null {
  let repW = 0;
  let custW = 0;
  for (const s of segments) {
    if (s.speaker === "agent") repW += wordCount(s.text);
    else if (s.speaker === "customer") custW += wordCount(s.text);
  }
  const total = repW + custW;
  if (total === 0) return null;
  const repShare = Math.round((repW / total) * 100);
  const custShare = 100 - repShare;
  // A read, not a verdict: door-to-door skews rep-heavy; ~40-60% rep talk is
  // a healthy two-way conversation. This is a plain observation (A11).
  let read: string;
  if (repShare >= 75) read = "You did most of the talking — leave more room to listen.";
  else if (repShare <= 35) read = "The customer carried it — strong listening.";
  else read = "A balanced two-way conversation.";
  return {
    key: "talk_ratio",
    label: LABELS.talk_ratio,
    score: Math.round((repW / total) * 10),
    display: `${repShare} / ${custShare}`,
    rationale: read,
    citation: null,
    computed: true,
  };
}

export async function generateSalesScores(args: {
  companyId: string;
  context?: SalesContext;
  segments: TranscriptSegment[];
}): Promise<SalesScores> {
  try {
    const agentSegments = args.segments.filter((s) => s.speaker === "agent");
    if (agentSegments.length < MIN_AGENT_SEGMENTS) return EMPTY;

    const talkRatio = computeTalkRatio(args.segments);

    const corpus = await getCurrentSalesCorpus(args.companyId).catch(() => null);
    const systemPrompt = buildSalesScoreSystemPrompt(corpus?.content);
    const userMessage = buildSalesScoreUserMessage({
      context: args.context,
      segments: args.segments,
    });

    const r = await dissectCoachV5({
      companyId: args.companyId,
      systemPrompt,
      userMessage,
    });
    // If grading failed but we have the computed ratio, still surface that one
    // honest number rather than nothing (§3.4 — degrade, don't fabricate).
    const graded = r.suppressed ? [] : parseGraded(r.text);
    const categories = orderCategories(graded, talkRatio);
    if (categories.length === 0) return EMPTY;
    return { hasSignal: true, categories };
  } catch {
    return EMPTY;
  }
}

/** Keep a stable display order: opener, objection, talk_ratio, tone, close
 *  (matches the PDF strip), including only the categories we actually have. */
function orderCategories(
  graded: ScoreCategory[],
  talkRatio: ScoreCategory | null
): ScoreCategory[] {
  const byKey = new Map<ScoreKey, ScoreCategory>();
  for (const c of graded) byKey.set(c.key, c);
  if (talkRatio) byKey.set("talk_ratio", talkRatio);
  const order: ScoreKey[] = ["opener", "objection", "talk_ratio", "tone", "close"];
  const out: ScoreCategory[] = [];
  for (const k of order) {
    const c = byKey.get(k);
    if (c) out.push(c);
  }
  return out;
}

function parseGraded(text: string): ScoreCategory[] {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return [];
  }
  if (typeof raw !== "object" || raw === null) return [];
  const o = raw as Record<string, unknown>;
  if (o.hasSignal === false || !Array.isArray(o.categories)) return [];

  const allowed: ScoreKey[] = ["opener", "objection", "tone", "close"];
  const out: ScoreCategory[] = [];
  for (const item of o.categories) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    const key = c.key as ScoreKey;
    if (!allowed.includes(key)) continue;
    const rawScore = typeof c.score === "number" ? c.score : NaN;
    if (Number.isNaN(rawScore)) continue;
    const score = Math.max(0, Math.min(10, Math.round(rawScore)));
    const rationale =
      typeof c.rationale === "string" ? c.rationale.trim() : "";
    const citation =
      typeof c.citation === "string" && c.citation.trim()
        ? c.citation.trim()
        : null;
    // A11: a score with no rationale is a naked verdict — drop it rather than
    // surface a number the rep can't inspect.
    if (!rationale) continue;
    out.push({
      key,
      label: LABELS[key],
      score,
      display: `${score}/10`,
      rationale,
      citation,
      computed: false,
    });
  }
  return out;
}
