import { createHash } from "node:crypto";
import { dissectCoachV5 } from "@/lib/claude";
import { DEEPSEEK_NONREASONING_MODEL } from "@/lib/llm/deepseek";
import { getCurrentSalesCorpus } from "@/lib/data/salesCoach";
import type { TranscriptSegment } from "@/lib/data/salesCoach";
import { buildPitchScoreSystemPrompt, parsePitchScoreResponse } from "./pitchScorePrompt";
import { scorePitch, type PitchScore } from "./scorePitch";
import type { GradedElement, DetectedBonus, DetectedViolation } from "./scorePitch";
import { SCORING_FLOOR } from "@/lib/coach/remote/decisions";

/**
 * Grade and score one recorded pitch — the wiring half of Project 1 Step 1.
 *
 * Shape follows generateSalesDissect: load the corpus, build a fenced prompt, call the LLM, and
 * distinguish the failure modes LOUDLY. The last part is the important one and it is not
 * defensive habit — this codebase has twice shipped a blank LLM answer that a bare catch turned
 * into an honest-looking empty state, and "Your read" was dead for two weeks with nothing in the
 * logs. On this surface the same bug would hand a rep a Pitch Score of 0 and "didn't reach
 * Discovery" for a recording nobody actually graded, and it would count against their average.
 *
 * So there is no zero-score failure path. Every outcome that is not a real grading returns an
 * explicit `ok: false` with a reason, and the caller must not persist it as a score.
 */

/** Why a grading did not produce a score. Each maps to a different operator response. */
export type PitchScoreFailure =
  | "no_agent_turns" // nothing for the rep to be graded on
  | "suppressed" // the brain gate declined the call
  | "llm_empty" // the model returned nothing — starvation or provider fault
  | "parse_failed"; // the model answered, but not with a usable grading

export type PitchScoreResult =
  | {
      ok: true;
      score: PitchScore;
      elements: GradedElement[];
      bonuses: DetectedBonus[];
      violations: DetectedViolation[];
      /** True when timestamps could not be derived, so the evidence has no play targets. */
      timestampsUnavailable: boolean;
      /**
       * What produced this grading (RSS Phase 0, Gong F15.8): the model that answered and the prompt
       * version. Optional only so older test doubles still type-check; the real scorer always sets it.
       */
      provenance?: { model: string; promptVersion: string };
    }
  | { ok: false; failure: PitchScoreFailure };

/**
 * The fewest rep transcript lines a recording needs to be graded. Exported (2026-10-01) because the backlog
 * count in pitch-score/backfill applies the same rule as a query, to stop offering "Score them all" for
 * recordings this function will always refuse; it compares against THIS constant, so the two cannot drift.
 */
// D5 (scoring floor, docs/rss/docs/00-OPEN-DECISIONS.md) lives in ONE place — decisions.ts — and today's value
// is today's behaviour (one rep segment). Deciding D5 changes it there, and this, the backfill count and the RSS
// session rule (state.ts scoringDecision) all follow (§2.2).
export const MIN_AGENT_SEGMENTS = SCORING_FLOOR.minRepSegments;

/**
 * The scoring prompt's version, DERIVED rather than typed (RSS Phase 0, provenance).
 *
 * No version label existed. A hand-kept constant is a promise someone has to remember on every prompt
 * edit, and a forgotten bump makes two different prompts look like one. Hashing the prompt TEMPLATE
 * (built with no company corpus, so it is the same for every tenant) changes exactly when the prompt
 * code changes. The company's own corpus is not part of it: that is content, recorded nowhere yet.
 */
export const PITCH_SCORE_PROMPT_VERSION =
  "tpl-" + createHash("sha256").update(buildPitchScoreSystemPrompt(null)).digest("hex").slice(0, 12);

/** mm:ss for the prompt — a model handles "4:12" far more reliably than 252. */
function mmss(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Render the transcript with offsets from the start of the recording.
 *
 * `spokenAt` is absolute wall-clock, so offsets are derived against the FIRST segment that has
 * one rather than against a passed-in start time — a recording uploaded days after it happened
 * has a `recorded_at` that is nowhere near its own audio, which this product has already been
 * bitten by ("a call recorded on the 4th was filed as happening on the 11th").
 *
 * When no segment carries a time, the transcript is rendered without offsets and the model is told
 * so explicitly. An invented timestamp is worse than a missing one: the play button on the rep's
 * Pitch detail would seek to the wrong moment and the evidence would look like a lie.
 */
export function buildPitchScoreUserMessage(args: {
  sessionTitle?: string;
  segments: readonly TranscriptSegment[];
  /**
   * Where the recording's audio clock starts: audioBaseIso(started_at, audio_started_at) (0300). The [m:ss] offsets —
   * and so every evidence timestampS the play button seeks to — are measured from it, so they are positions IN THE
   * AUDIO. Until 2026-11-21 they were measured from the first line spoken, while this prompt told the model "from the
   * start of the recording": every play button seeked early or late by the silence before the first word. Absent →
   * the first spoken line, the old base (only for a session with no start time at all).
   */
  audioBase?: string | null;
}): { message: string; timestampsUnavailable: boolean } {
  const timed = args.segments.filter((s) => !!s.spokenAt);
  const fromAudio = args.audioBase ? Date.parse(args.audioBase) : NaN;
  const baseMs = timed.length === 0 ? NaN : Number.isFinite(fromAudio) ? fromAudio : Date.parse(timed[0]!.spokenAt as string);
  const timestampsUnavailable = !Number.isFinite(baseMs);

  const lines = args.segments.map((s) => {
    const who = s.speaker === "agent" ? "REP" : "CUSTOMER";
    if (timestampsUnavailable || !s.spokenAt) return `${who}: ${s.text}`;
    const offset = Math.max(0, Math.round((Date.parse(s.spokenAt) - baseMs) / 1000));
    return Number.isFinite(offset) ? `[${mmss(offset)}] ${who}: ${s.text}` : `${who}: ${s.text}`;
  });

  const header = args.sessionTitle ? `Recording: ${args.sessionTitle}\n\n` : "";
  const note = timestampsUnavailable
    ? `This transcript has NO timestamps. Omit timestampS from every item rather than estimating one — a wrong timestamp sends the rep's play button to the wrong moment.\n\n`
    : `Timestamps are [m:ss] from the start of the recording. Use them for timestampS (as whole seconds).\n\n`;

  return {
    message: `${header}${note}TRANSCRIPT (diarized; REP is the person being scored):\n\n${lines.join("\n")}`,
    timestampsUnavailable,
  };
}

export async function generatePitchScore(args: {
  companyId: string;
  sessionTitle?: string;
  segments: readonly TranscriptSegment[];
  /** The coaching session being graded, for the AI cost ledger (cost per session, RSS Phase 0 step 6). */
  sessionId?: string;
  /** audioBaseIso(started_at, audio_started_at) — see buildPitchScoreUserMessage. */
  audioBase?: string | null;
}): Promise<PitchScoreResult> {
  const agentSegments = args.segments.filter((s) => s.speaker === "agent");
  if (agentSegments.length < MIN_AGENT_SEGMENTS) return { ok: false, failure: "no_agent_turns" };

  // The company's own pitch, for recognising the phases. A missing corpus is not fatal — the
  // rubric describes what has to land independently of any script — so a failed load degrades to
  // an unscripted prompt rather than blocking the scoring.
  const corpus = await getCurrentSalesCorpus(args.companyId).catch(() => null);
  const systemPrompt = buildPitchScoreSystemPrompt(corpus?.content);
  const { message, timestampsUnavailable } = buildPitchScoreUserMessage({
    sessionTitle: args.sessionTitle,
    segments: args.segments,
    audioBase: args.audioBase,
  });

  const r = await dissectCoachV5({
    companyId: args.companyId,
    systemPrompt,
    userMessage: message,
    // NON-REASONING model, deliberately, and this is the load-bearing line in the file.
    //
    // A full grading is ~30 element rows plus bonuses and violations, each with an id, grade,
    // timestamp and a short quote — measured at ~1,440 tokens typical and ~1,785 worst case. The
    // reasoning model spends most of the 8,000-token ceiling on reasoning before it writes a word,
    // which is exactly how the 2026-07-30 and 2026-08-13 blank-output incidents happened, and an
    // answer this long is far more likely to be truncated than a dissect's few paragraphs.
    //
    // Grading against a fixed rubric is mechanical extraction, not deliberation, so it loses little
    // and gains the whole budget for the answer. Same reasoning, same fix as the meeting dissect.
    model: DEEPSEEK_NONREASONING_MODEL,
    engine: "pitch_score",
    ...(args.sessionId ? { sessionId: args.sessionId } : {}),
  });

  // Consume the gate's VERDICT rather than re-deriving it (§2.2). The account-based empty-AI
  // outage happened precisely because a caller re-computed a suppression decision the authority
  // had already made, and dropped a term while doing it.
  if (r.suppressed) return { ok: false, failure: "suppressed" };

  if (!r.text || !r.text.trim()) {
    // eslint-disable-next-line no-console
    console.error(
      `[generatePitchScore] LLM returned EMPTY text (model=${r.model}, provider=${r.provider}) — token starvation or provider fault. NOT stored as a zero score.`
    );
    return { ok: false, failure: "llm_empty" };
  }

  const parsed = parsePitchScoreResponse(r.text);
  if (!parsed) {
    // eslint-disable-next-line no-console
    console.error(
      `[generatePitchScore] could not parse a grading from the reply (textLen=${r.text.length}, model=${r.model}) — malformed JSON, missing flags, or no element grades. NOT stored as a zero score.`
    );
    return { ok: false, failure: "parse_failed" };
  }

  const elements: GradedElement[] = parsed.elements.map((e) => ({
    elementId: e.elementId,
    grade: e.grade,
    ...(e.timestampS !== undefined ? { timestampS: e.timestampS } : {}),
    ...(e.evidence !== undefined ? { evidence: e.evidence } : {}),
  }));
  const bonuses: DetectedBonus[] = parsed.bonuses.map((b) => ({
    bonusId: b.bonusId,
    ...(b.timestampS !== undefined ? { timestampS: b.timestampS } : {}),
    ...(b.evidence !== undefined ? { evidence: b.evidence } : {}),
    ...(b.confidence !== undefined ? { confidence: b.confidence } : {}),
  }));
  const violations: DetectedViolation[] = parsed.violations.map((v) => ({
    violationId: v.violationId,
    ...(v.timestampS !== undefined ? { timestampS: v.timestampS } : {}),
    ...(v.evidence !== undefined ? { evidence: v.evidence } : {}),
  }));

  const score = scorePitch({
    elements,
    bonuses,
    violations,
    objectionOccurred: parsed.objectionOccurred,
    reachedDiscovery: parsed.reachedDiscovery,
  });

  return {
    ok: true,
    score,
    elements,
    bonuses,
    violations,
    timestampsUnavailable,
    provenance: { model: r.model, promptVersion: PITCH_SCORE_PROMPT_VERSION },
  };
}
