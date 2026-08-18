/**
 * Door Log state machine (Macro Mode — Tab 1). Pure, decision-independent logic.
 *
 * The spec (2.1) mandates the flow be an explicit state machine, not scattered component state, and
 * that illegal transitions be impossible:
 *
 *   IDLE ──[NO_ANSWER]────────► (log knock) ──► IDLE
 *     └──[RECORD_PITCH]──► RECORDING ──[STOP_RECORD]──► OUTCOME ──[PICK_OUTCOME]──► NAMING ──[SAVE]──► IDLE
 *
 * This module is independent of every open question (consent/Q2, visibility/Q4, sales-day/Q5, toggle):
 * those are backend/RLS/UI-gate concerns. If Q2 resolves to an in-flow consent step, a `CONSENT` state
 * is inserted between IDLE and RECORDING — a localized extension that does not change the transitions
 * below. Uncommitted pending founder greenlight + the Phase 6 gate.
 */

/** A pitch's tagged outcome — the four OUTCOME-screen choices (2.1). `no_answer` is NOT here: it is
 *  logged directly from IDLE and never produces a pitch. */
export const PITCH_OUTCOMES = ["sold", "go_back", "non_decision_maker", "not_interested"] as const;
export type PitchOutcome = (typeof PITCH_OUTCOMES)[number];

export type DoorLogState = "idle" | "recording" | "outcome" | "naming";

export type DoorLogEvent =
  | { type: "NO_ANSWER" } // log a no-answer knock, stay home
  | { type: "RECORD_PITCH" } // begin capture
  | { type: "STOP_RECORD" } // end capture → tag outcome
  | { type: "PICK_OUTCOME"; outcome: PitchOutcome } // choose 1 of 4 → name it
  | { type: "SAVE" }; // save the name → back to the next door

/**
 * The transition function. Returns the next state, or the SAME state for any event that is illegal
 * from the current state (so an illegal transition is a no-op, never a jump). This is the single
 * source of truth for the flow — the UI dispatches events, it does not set state directly.
 */
export function transition(state: DoorLogState, event: DoorLogEvent): DoorLogState {
  switch (state) {
    case "idle":
      if (event.type === "RECORD_PITCH") return "recording";
      // NO_ANSWER logs a knock (side effect handled by the caller) and returns home.
      if (event.type === "NO_ANSWER") return "idle";
      return state;
    case "recording":
      if (event.type === "STOP_RECORD") return "outcome";
      return state;
    case "outcome":
      if (event.type === "PICK_OUTCOME") return "naming";
      return state;
    case "naming":
      if (event.type === "SAVE") return "idle";
      return state;
    default:
      return state;
  }
}

/** True iff the event causes a real state change from `state` (used by the UI to know when to animate
 *  and by tests to assert the legal-transition set). */
export function isLegalTransition(state: DoorLogState, event: DoorLogEvent): boolean {
  return transition(state, event) !== state;
}

/** The count of taps from STOP_RECORD back to IDLE, for the 8 "≤2 taps, zero waiting" guarantee:
 *  STOP_RECORD → OUTCOME (pick = tap 1) → NAMING (save = tap 2) → IDLE. */
export const TAPS_STOP_TO_IDLE = 2;
