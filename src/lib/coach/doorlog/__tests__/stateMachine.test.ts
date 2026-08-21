import { describe, it, expect } from "vitest";
import {
  transition,
  isLegalTransition,
  TAPS_STOP_TO_IDLE,
  type DoorLogState,
  type DoorLogEvent,
} from "../stateMachine";

/**
 * 5.1 — every legal transition holds, and illegal ones are impossible (no-op, never a jump).
 */
describe("Door Log state machine", () => {
  it("walks the full happy path IDLE→RECORDING→OUTCOME→NAMING→IDLE", () => {
    let s: DoorLogState = "idle";
    s = transition(s, { type: "RECORD_PITCH" });
    expect(s).toBe("recording");
    s = transition(s, { type: "STOP_RECORD" });
    expect(s).toBe("outcome");
    s = transition(s, { type: "PICK_OUTCOME", outcome: "sold" });
    expect(s).toBe("naming");
    s = transition(s, { type: "SAVE" });
    expect(s).toBe("idle");
  });

  it("NO_ANSWER logs a knock and returns home (stays IDLE)", () => {
    expect(transition("idle", { type: "NO_ANSWER" })).toBe("idle");
  });

  it("NO_ANSWER from OUTCOME discards the recording and returns home (founder 2026-08-22)", () => {
    // A rep who started recording expecting contact — and nobody came out — tags the door No-Answer from
    // the outcome screen instead of a false Sold/Go-Back/Not-Interested. It's a real state change here
    // (OUTCOME → IDLE), unlike the IDLE self-transition.
    expect(transition("outcome", { type: "NO_ANSWER" })).toBe("idle");
    expect(isLegalTransition("outcome", { type: "NO_ANSWER" })).toBe(true);
    // Still illegal mid-recording and mid-naming — you tag No-Answer after Stop, on the outcome screen.
    expect(transition("recording", { type: "NO_ANSWER" })).toBe("recording");
    expect(transition("naming", { type: "NO_ANSWER" })).toBe("naming");
  });

  it("LOG_OUTCOME jumps IDLE→OUTCOME (no-mic path — tag the outcome without recording)", () => {
    // Founder 2026-08-21: a mic-less rep reaches the OUTCOME screen directly, skipping RECORDING, so they
    // can still log Sold/Go-Back. It only fires from IDLE — never mid-recording or mid-naming.
    expect(transition("idle", { type: "LOG_OUTCOME" })).toBe("outcome");
    expect(transition("recording", { type: "LOG_OUTCOME" })).toBe("recording");
    expect(transition("outcome", { type: "LOG_OUTCOME" })).toBe("outcome");
    expect(transition("naming", { type: "LOG_OUTCOME" })).toBe("naming");
  });

  it("makes an illegal transition impossible — no path from IDLE straight to NAMING", () => {
    // There is no event that jumps IDLE → naming.
    const events: DoorLogEvent[] = [
      { type: "STOP_RECORD" },
      { type: "PICK_OUTCOME", outcome: "sold" },
      { type: "SAVE" },
    ];
    for (const e of events) {
      expect(transition("idle", e)).toBe("idle"); // no-op, never a jump
      expect(isLegalTransition("idle", e)).toBe(false);
    }
  });

  it("every state only accepts its own events (exhaustive legal set)", () => {
    const legal: Record<DoorLogState, DoorLogEvent[]> = {
      idle: [{ type: "RECORD_PITCH" }, { type: "LOG_OUTCOME" }, { type: "NO_ANSWER" }],
      recording: [{ type: "STOP_RECORD" }],
      outcome: [{ type: "PICK_OUTCOME", outcome: "go_back" }, { type: "NO_ANSWER" }],
      naming: [{ type: "SAVE" }],
    };
    const allEvents: DoorLogEvent[] = [
      { type: "RECORD_PITCH" },
      { type: "LOG_OUTCOME" },
      { type: "NO_ANSWER" },
      { type: "STOP_RECORD" },
      { type: "PICK_OUTCOME", outcome: "not_interested" },
      { type: "SAVE" },
    ];
    for (const state of ["idle", "recording", "outcome", "naming"] as DoorLogState[]) {
      for (const e of allEvents) {
        const legalHere = legal[state].some((le) => le.type === e.type);
        // NO_ANSWER is a self-transition on idle (legal but state-preserving), so isLegalTransition
        // (which keys on a state CHANGE) is false for it; assert the change-set excludes it.
        const changesState = legalHere && !(state === "idle" && e.type === "NO_ANSWER");
        expect(isLegalTransition(state, e)).toBe(changesState);
      }
    }
  });

  it("STOP_RECORD → IDLE is two taps (the 8 ergonomics guarantee)", () => {
    expect(TAPS_STOP_TO_IDLE).toBe(2);
  });
});
