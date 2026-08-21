import "server-only";
import type { CoachingStrategy, CueLLM } from "./coachingStrategy";
import { MeetingStrategy } from "./meeting/meetingStrategy";
import { HuddleStrategy } from "./huddle/huddleStrategy";
import { SalesStrategy } from "./salesStrategy";

/**
 * Strategy selector — maps a session's coaching MODE to its brain (Phase-5 "mode selection", built as a pure
 * unit ahead of the live wiring). Single-source for mode→strategy (§2.2): adding a mode is one `case` here, and
 * the exhaustiveness guard (`never`) makes the compiler FAIL if a new CoachingMode is added without a case — so
 * a mode can never silently fall through to the wrong brain.
 *
 * Takes an EXPLICIT CoachingMode, NOT a raw `coaching_sessions.context`/`session_kind` value — the
 * sessionKind→mode resolution depends on the (founder-gated) mode migration shape and is done at wire time.
 * Keeping this keyed on the mode enum makes it decision-independent and testable now.
 *
 * The meeting/huddle brains need the injected `CueLLM` (their control-gate/model is chosen at wire time); the
 * SalesStrategy adapter wraps the existing `generateLiveCue` and takes none — the registry hides that asymmetry.
 */
export type CoachingMode = "sales" | "meeting" | "huddle";

export function selectStrategy(mode: CoachingMode, deps: { cueLLM: CueLLM }): CoachingStrategy {
  switch (mode) {
    case "meeting":
      return new MeetingStrategy(deps.cueLLM);
    case "huddle":
      return new HuddleStrategy(deps.cueLLM);
    case "sales":
      return new SalesStrategy();
    default: {
      // Exhaustiveness: if a new CoachingMode is added without a case, this line stops compiling.
      const _exhaustive: never = mode;
      throw new Error(`selectStrategy: unknown coaching mode ${String(_exhaustive)}`);
    }
  }
}
