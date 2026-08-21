import "server-only";
import type {
  CoachingStrategy,
  CoachingContext,
  CueDecision,
  CueLLM,
  StrategyTranscriptSegment,
} from "../coachingStrategy";
import { buildMeetingCueSystemPrompt, buildMeetingCueUserMessage } from "./meetingCuePrompt";
import { parseMeetingCue } from "./parseMeetingCue";
import { distinctKnownSpeakers } from "../renderTurns";

/**
 * MeetingStrategy — the Meeting Coach brain as a CoachingStrategy (Phase-3 of docs/MeetingCoach-BuildPlan.md).
 *
 * ┌─ STATUS: PROPOSED · complete + tested, but the ENGINE does not call it yet (step-3 wiring held) ─┐
 * │ Assembles the meeting brain end-to-end: understanding gate → prompt → LLM (injected) → parse →   │
 * │ CueDecision. The LLM is dependency-INJECTED (CueLLM), so this class carries NO binding/model/     │
 * │ control-gate decision — those plug in at wire time. Pure orchestration; testable with a fake LLM.  │
 * └───────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Mirrors the sales generateLiveCue orchestration (liveCue.ts): a MIN_SEGMENTS understanding gate (§3.2 — need
 * enough to read the room before advising), a rolling window (latency + relevance), honor the LLM's
 * `suppressed` verdict WITHOUT re-deriving it (A40), parse silent-safe, and NEVER throw — a cue failure must
 * not disrupt a live meeting (it resolves to stay-silent).
 */

/** Only reason over the most recent N turns — a meeting has long context, but the coach reacts to the live moment. */
const ROLLING_WINDOW = 14;
/** Need at least this much conversation to read the situation honestly (§3.2). */
const MIN_SEGMENTS = 2;

const SILENT: CueDecision = { shouldCue: false, cue: null, trigger: "none", phase: "unknown", importance: "low" };

export class MeetingStrategy implements CoachingStrategy {
  readonly kind = "meeting";

  constructor(private readonly llm: CueLLM) {}

  async analyze(
    segments: StrategyTranscriptSegment[],
    context: CoachingContext
  ): Promise<CueDecision> {
    try {
      // Understanding gate: too little to read → silent (unless the facilitator explicitly asked).
      if (!context.force && segments.length < MIN_SEGMENTS) return SILENT;

      const recent = segments.slice(-ROLLING_WINDOW);
      const systemPrompt = buildMeetingCueSystemPrompt(context.mode);
      const userMessage = buildMeetingCueUserMessage({
        recentSegments: recent,
        nearingEnd: context.signals?.["nearingEnd"] === true,
      });

      const r = await this.llm({ systemPrompt, userMessage });
      // A40: consume the gate's verdict — a suppressed call means the control gate declined; stay silent
      // without parsing (don't re-derive the gate here).
      if (r.suppressed) return SILENT;

      const decision = parseMeetingCue(r.text, { force: context.force });
      // A30/A39 CODE gate (not just a prompt instruction): the `imbalance` trigger asserts WHO is dominating,
      // which is unknowable without ≥2 distinct KNOWN speakers in the window. If the transcript is unattributed
      // (all UNKNOWN, or one voice), suppress an imbalance cue rather than let the model guess who's quiet.
      if (decision.trigger === "imbalance" && distinctKnownSpeakers(recent) < 2) return SILENT;

      return decision;
    } catch {
      // A cue failure can never disrupt a live meeting (§3.4 honesty over a broken cue).
      return SILENT;
    }
  }
}
