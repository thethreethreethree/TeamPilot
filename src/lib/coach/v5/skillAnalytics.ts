import type { ScoreCategory } from "./summaryTypes";
import type { TranscriptSegment } from "@/lib/data/salesCoach";

/**
 * Personal skill analytics (ELOSTATE spec p3, founder-confirmed 2026-07-15).
 *
 * The Standard Analytics tab is "all about the user — when they come home and want
 * to learn from their day." It replaces the 1515 ELO number and the team aggregate
 * with SIX per-skill scores out of 10, each with a short AI breakdown.
 *
 * This module is the PURE scoring core: it turns a set of past-session score cards
 * (from after_pitch_summaries) + transcript timing into six /10 skill scores. No IO,
 * no LLM, no React — so the scoring rules are unit-testable in isolation and the
 * two non-obvious mappings (talk/listen, speed) are visible and tunable in ONE place.
 *
 * FOUR skills are already graded /10 by the rubric and just get AVERAGED across
 * sessions: tone, objection, closing — plus questions, mapped from its rate.
 * TWO are not /10 today and are mapped here (founder-confirmed "balance-based"):
 *   - talk_listen: 10 at a balanced ~50/50 conversation, sliding DOWN as it skews.
 *     A rep who did 100% of the talking scores low — because the skill is listening,
 *     not volume. Peaks at healthy, never at "more".
 *   - speed: 10 inside a comfortable pace band, lower when too fast or too slow.
 *
 * §3.4: a skill with no data returns score=null ("not enough yet"), never 0 — a 0
 * reads as "you are terrible at this", which is a different and false claim from
 * "we haven't measured this yet". Speed in particular is null when the transcript
 * carries no timing, exactly as flagged: honest "not yet", never an invented number.
 *
 * The band CONSTANTS below are the founder's to tune — they are named and grouped
 * so a change is one edit, not a hunt.
 */

export type SkillKey =
  | "talk_listen"
  | "tone"
  | "speed"
  | "questions"
  | "objection"
  | "closing";

export type SkillScore = {
  key: SkillKey;
  label: string;
  /** 0–10, or null when there isn't enough data to score honestly (§3.4). */
  score: number | null;
  /** How many sessions fed this score — surfaced so the rep knows the weight. */
  sampleSize: number;
  /** A short, human read of the band — the deterministic fallback the AI
   *  breakdown can replace, and the thing shown if the LLM pass is unavailable. */
  read: string;
};

export const SKILL_LABELS: Record<SkillKey, string> = {
  talk_listen: "Talk / Listen",
  tone: "Tone",
  speed: "Speed of speech",
  questions: "Questions",
  objection: "Objection handling",
  closing: "Closing",
};

// ── Tunable bands (founder's to adjust) ──────────────────────────────────────
/** Talk/Listen: the ideal rep share of the conversation, and how many points are
 *  lost per percentage-point away from it. 50% ideal, 5 pts skew per point → a
 *  75/25 call scores 5/10, a 100/0 call scores 0/10. */
const TALK_IDEAL_REP_SHARE = 50;
const TALK_PTS_PER_SKEW = 5;
/** Speed: the comfortable words-per-minute band (inclusive) scores a full 10; each
 *  10 wpm outside the band costs a point. ~130 wpm is unhurried, clear delivery. */
const SPEED_BAND_LOW = 110;
const SPEED_BAND_HIGH = 150;
const SPEED_WPM_PER_POINT = 10;
/** Below this many timed words we won't compute a pace — too small to be honest. */
const SPEED_MIN_WORDS = 40;

function clamp10(n: number): number {
  return Math.max(0, Math.min(10, Math.round(n)));
}

/** Balance-based talk/listen: peaks at the ideal rep share, falls off symmetrically. */
export function talkListenScore(repSharePct: number): number {
  return clamp10(10 - (Math.abs(repSharePct - TALK_IDEAL_REP_SHARE) / TALK_PTS_PER_SKEW));
}

/** Pace score: full marks inside the band, a point off per SPEED_WPM_PER_POINT out. */
export function speedScore(wpm: number): number {
  if (wpm >= SPEED_BAND_LOW && wpm <= SPEED_BAND_HIGH) return 10;
  const dist = wpm < SPEED_BAND_LOW ? SPEED_BAND_LOW - wpm : wpm - SPEED_BAND_HIGH;
  return clamp10(10 - dist / SPEED_WPM_PER_POINT);
}

/** Words per minute for the AGENT only, across a session's timed segments. Returns
 *  null when there isn't enough timed speech to be honest (§3.4). */
export function agentWpm(segments: TranscriptSegment[]): number | null {
  const timed = segments
    .filter((s) => s.speaker === "agent" && s.spokenAt)
    .map((s) => ({ t: Date.parse(s.spokenAt as string), words: wordCount(s.text) }))
    .filter((x) => Number.isFinite(x.t));
  if (timed.length < 2) return null;
  const words = timed.reduce((sum, x) => sum + x.words, 0);
  if (words < SPEED_MIN_WORDS) return null;
  timed.sort((a, b) => a.t - b.t);
  const first = timed[0];
  const last = timed[timed.length - 1];
  if (!first || !last) return null;
  const spanMs = last.t - first.t;
  if (spanMs <= 0) return null;
  const minutes = spanMs / 60000;
  return words / minutes;
}

function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Parse the rep share (0–100) from a talk_ratio category. Its `display` is
 *  "73 / 27"; fall back to `score` (rep tenths) if the display is malformed. */
function repShareFrom(cat: ScoreCategory): number | null {
  if (cat.caveat) return null; // one-sided call — not a real ratio (§3.4)
  const m = cat.display.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (m) return Number(m[1]);
  if (Number.isFinite(cat.score)) return cat.score * 10;
  return null;
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** Map a question-rate category (share of rep turns that ask a question) onto a
 *  /10 quality band: too few is the real failure; a healthy discovery rate scores
 *  high; question-heavy is fine but not perfect (you must also land value). */
function questionScoreFrom(cat: ScoreCategory): number | null {
  // display is "3 of 8" → pct
  const m = cat.display.match(/^(\d+)\s+of\s+(\d+)$/);
  if (!m || Number(m[2]) === 0) return null;
  const pct = (Number(m[1]) / Number(m[2])) * 100;
  if (pct < 15) return clamp10(3 + pct / 5); // 0%→3, ~15%→6
  if (pct <= 55) return clamp10(9); // healthy discovery
  return clamp10(7); // question-heavy: good, land your value too
}

function bandRead(key: SkillKey, score: number | null): string {
  if (score === null) return "Not enough sessions yet to score this.";
  if (score >= 8) return "Strong — keep doing this.";
  if (score >= 5) return "Solid, with room to sharpen.";
  return "The clearest thing to work on next.";
}

/**
 * Aggregate a rep's recent sessions into six skill scores. `perSession` is the
 * `scores` array from each stored after-pitch summary; `wpms` are the per-session
 * agent words-per-minute (null where a session had no timing). Both are matched by
 * position but used independently, so a missing one never blocks the others.
 */
export function aggregateSkills(
  perSession: ScoreCategory[][],
  wpms: (number | null)[]
): SkillScore[] {
  const pick = (key: string): ScoreCategory[] =>
    perSession
      .map((cats) => cats.find((c) => c.key === key))
      .filter((c): c is ScoreCategory => Boolean(c));

  // talk/listen — balance of each session's rep share, then averaged
  const talkShares = pick("talk_ratio")
    .map(repShareFrom)
    .filter((n): n is number => n !== null);
  const talkScore =
    talkShares.length > 0
      ? clamp10(avg(talkShares.map(talkListenScore)) as number)
      : null;

  // speed — average of the sessions that HAD timing
  const validWpms = wpms.filter((w): w is number => w !== null && Number.isFinite(w));
  const speedScoreVal =
    validWpms.length > 0 ? clamp10(avg(validWpms.map(speedScore)) as number) : null;

  // questions — band map per session, averaged
  const qScores = pick("question_rate")
    .map(questionScoreFrom)
    .filter((n): n is number => n !== null);
  const questionsScore = qScores.length > 0 ? clamp10(avg(qScores) as number) : null;

  // the true /10 graded skills — direct average
  const gradedAvg = (key: string): { score: number | null; n: number } => {
    const scores = pick(key).map((c) => c.score);
    return { score: scores.length ? clamp10(avg(scores) as number) : null, n: scores.length };
  };
  const tone = gradedAvg("tone");
  const objection = gradedAvg("objection");
  const closing = gradedAvg("close");

  const out: SkillScore[] = [
    { key: "talk_listen", label: SKILL_LABELS.talk_listen, score: talkScore, sampleSize: talkShares.length, read: bandRead("talk_listen", talkScore) },
    { key: "tone", label: SKILL_LABELS.tone, score: tone.score, sampleSize: tone.n, read: bandRead("tone", tone.score) },
    { key: "speed", label: SKILL_LABELS.speed, score: speedScoreVal, sampleSize: validWpms.length, read: bandRead("speed", speedScoreVal) },
    { key: "questions", label: SKILL_LABELS.questions, score: questionsScore, sampleSize: qScores.length, read: bandRead("questions", questionsScore) },
    { key: "objection", label: SKILL_LABELS.objection, score: objection.score, sampleSize: objection.n, read: bandRead("objection", objection.score) },
    { key: "closing", label: SKILL_LABELS.closing, score: closing.score, sampleSize: closing.n, read: bandRead("closing", closing.score) },
  ];
  return out;
}
