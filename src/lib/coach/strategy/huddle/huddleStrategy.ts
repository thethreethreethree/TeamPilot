import "server-only";
import type {
  CoachingStrategy,
  CoachingContext,
  CueDecision,
  CueLLM,
  StrategyTranscriptSegment,
} from "../coachingStrategy";
import { buildHuddleCueSystemPrompt, buildHuddleCueUserMessage } from "./huddleCuePrompt";
import { parseHuddleCue } from "./parseHuddleCue";

/**
 * HuddleStrategy — the Huddle Coach brain as a CoachingStrategy (Phase-4). Same orchestration as
 * MeetingStrategy, tuned tighter: a shorter rolling window (a huddle is fast + shallow) and the higher cue
 * threshold lives in the prompt (near-silent). LLM dependency-injected; pure; never throws. Engine does not
 * call it yet (step-3 wiring held).
 */

/** A huddle is short + shallow — a tighter window keeps the coach on the live status, not the whole stand-up. */
const ROLLING_WINDOW = 10;
/** Need at least this much to read a status honestly (§3.2). */
const MIN_SEGMENTS = 2;

const SILENT: CueDecision = { shouldCue: false, cue: null, trigger: "none", phase: "unknown", importance: "low" };

export class HuddleStrategy implements CoachingStrategy {
  readonly kind = "huddle";

  constructor(private readonly llm: CueLLM) {}

  async analyze(
    segments: StrategyTranscriptSegment[],
    context: CoachingContext
  ): Promise<CueDecision> {
    try {
      if (!context.force && segments.length < MIN_SEGMENTS) return SILENT;

      const recent = segments.slice(-ROLLING_WINDOW);
      const systemPrompt = buildHuddleCueSystemPrompt(context.mode);
      const userMessage = buildHuddleCueUserMessage({
        recentSegments: recent,
        nearingEnd: context.signals?.["nearingEnd"] === true,
      });

      const r = await this.llm({ systemPrompt, userMessage });
      if (r.suppressed) return SILENT; // A40: consume the gate's verdict, don't re-derive

      return parseHuddleCue(r.text, { force: context.force });
    } catch {
      return SILENT;
    }
  }
}
