import "server-only";
import { dissectCoachV5 } from "@/lib/claude";
import { groundQuote } from "./grounding";
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

// §A13 — shapes defined once in summaryTypes; re-exported for existing importers.
export type { ScoreKey, ScoreCategory } from "./summaryTypes";
import type { ScoreKey, ScoreCategory } from "./summaryTypes";

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
  question_rate: "Questions",
  tone: "Tone",
  close: "Close",
  next_step: "Next step",
};

function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Does this rep utterance ask a question? A '?' is the strong signal; also
 *  catch interrogative openers a transcript might not punctuate. Deterministic. */
function isQuestion(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  if (t.includes("?")) return true;
  return /^(who|what|when|where|why|how|which|do|does|did|are|is|can|could|would|will|have|has|may|might)\b/.test(
    t
  );
}

/** Deterministic QUESTION RATE (hard data, founder 2026-07-07): the share of the
 *  rep's turns that ask a question — a discovery-quality signal. Like talk_ratio
 *  this is a COUNT surfaced as an observation (A11 — not a good/bad grade); the
 *  `read` names the pattern, the rep decides. `score` is only for uniform strip
 *  rendering; `display` + `computed` carry the honest meaning. */
export function computeQuestionRate(
  segments: TranscriptSegment[]
): ScoreCategory | null {
  const repTurns = segments.filter((s) => s.speaker === "agent");
  if (repTurns.length === 0) return null;
  const asked = repTurns.filter((s) => isQuestion(s.text)).length;
  const pct = Math.round((asked / repTurns.length) * 100);
  // `flagged` = a growth band the Next Door Focus may promote to THE fix. Only
  // the too-few end is a growth signal; question-heavy is a strength, not a fix.
  let read: string;
  let flagged = false;
  let focusSuggestion: string | undefined;
  if (pct <= 15) {
    read = "Few questions — discovery leans on the customer opening up; ask more to learn their real need.";
    flagged = true;
    focusSuggestion = "Ask more discovery questions";
  } else if (pct >= 55) {
    read = "Question-heavy — strong discovery; make sure you also land your value.";
  } else read = "A healthy amount of discovery questioning.";
  return {
    key: "question_rate",
    label: LABELS.question_rate,
    score: Math.round((asked / repTurns.length) * 10),
    display: `${asked} of ${repTurns.length}`,
    rationale: read,
    citation: null,
    computed: true,
    flagged,
    focusSuggestion,
  };
}

/** Deterministic talk ratio (hard data). Returns rep vs customer share as
 *  whole-number percents that sum to 100, plus a plain-language read. Exported
 *  for test — the caveat + flagged invariants are constitutional (§3.4). */
export function computeTalkRatio(
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

  // F2 (§3.4): if the customer side carries NO transcribed words but the rep
  // does, this is almost certainly a CAPTURE GAP — a one-sided recording — not a
  // rep who literally never let the customer speak. Reporting "100 / 0 — you
  // talked too much" would coach on an artifact, presenting a data gap as a
  // measurement. So we return an honest caveat, never a verdict, and never a
  // flagged growth signal (a caveat must not become the Next Door Focus).
  if (custW === 0) {
    return {
      key: "talk_ratio",
      label: LABELS.talk_ratio,
      score: 0,
      display: "—",
      rationale:
        "We couldn't hear the customer's side on this one, so there's no talk/listen read to give. Check that both sides of the call are being captured.",
      citation: null,
      computed: true,
      caveat: true,
      flagged: false,
    };
  }

  const repShare = Math.round((repW / total) * 100);
  const custShare = 100 - repShare;
  // A read, not a verdict: door-to-door skews rep-heavy; ~40-60% rep talk is
  // a healthy two-way conversation. This is a plain observation (A11).
  // `flagged` = the rep-dominant growth band the Next Door Focus may promote.
  // The customer-carried end is a strength, not a fix — so it is never flagged.
  let read: string;
  let flagged = false;
  let focusSuggestion: string | undefined;
  if (repShare >= 75) {
    read = "You did most of the talking — leave more room to listen.";
    flagged = true;
    focusSuggestion = "Leave more room to listen";
  } else if (repShare <= 35) read = "The customer carried it — strong listening.";
  else read = "A balanced two-way conversation.";
  return {
    key: "talk_ratio",
    label: LABELS.talk_ratio,
    score: Math.round((repW / total) * 10),
    display: `${repShare} / ${custShare}`,
    rationale: read,
    citation: null,
    computed: true,
    flagged,
    focusSuggestion,
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
    const questionRate = computeQuestionRate(args.segments);

    const [corpus, product] = await Promise.all([
      getCurrentSalesCorpus(args.companyId).catch(() => null),
      getCurrentSalesCorpus(args.companyId, "product").catch(() => null),
    ]);
    const systemPrompt = buildSalesScoreSystemPrompt(corpus?.content, product?.content);
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
    const graded = r.suppressed ? [] : parseGraded(r.text, args.segments);
    const categories = orderCategories(graded, talkRatio, questionRate);
    if (categories.length === 0) return EMPTY;
    return { hasSignal: true, categories };
  } catch {
    return EMPTY;
  }
}

/** Keep a stable display order (matches the score strip), including only the
 *  categories we actually have. The two computed categories (talk_ratio,
 *  question_rate) are interleaved by their natural place in the rubric. */
function orderCategories(
  graded: ScoreCategory[],
  talkRatio: ScoreCategory | null,
  questionRate: ScoreCategory | null
): ScoreCategory[] {
  const byKey = new Map<ScoreKey, ScoreCategory>();
  for (const c of graded) byKey.set(c.key, c);
  if (talkRatio) byKey.set("talk_ratio", talkRatio);
  if (questionRate) byKey.set("question_rate", questionRate);
  const order: ScoreKey[] = [
    "opener",
    "objection",
    "talk_ratio",
    "question_rate",
    "tone",
    "close",
    "next_step",
  ];
  const out: ScoreCategory[] = [];
  for (const k of order) {
    const c = byKey.get(k);
    if (c) out.push(c);
  }
  return out;
}

// Exported for test: parseGraded enforces §3.5 measurement honesty — a score is
// CLAMPED to [0,10], only the four known categories are accepted, a non-numeric
// score is dropped, and (A11) a score with NO rationale is dropped rather than
// surface a number the rep can't inspect. Constitutional invariants worth pinning.
export function parseGraded(
  text: string,
  segments: TranscriptSegment[] = []
): ScoreCategory[] {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return [];
  }
  if (typeof raw !== "object" || raw === null) return [];
  const o = raw as Record<string, unknown>;
  if (o.hasSignal === false || !Array.isArray(o.categories)) return [];

  const allowed: ScoreKey[] = [
    "opener",
    "objection",
    "tone",
    "close",
    "next_step",
  ];
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
    // A11/§3.4: the citation must be a real transcript quote (the evidence a rep can
    // inspect/contest). Ground it when segments are available; a citation whose words
    // aren't in the transcript is dropped rather than surfaced as false evidence. The
    // default (no segments — unit tests) keeps the prior trim-only behavior.
    const citation =
      segments.length > 0
        ? groundQuote(c.citation as string | null, segments)
        : typeof c.citation === "string" && c.citation.trim()
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
