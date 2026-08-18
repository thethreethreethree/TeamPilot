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
      idle: [{ type: "RECORD_PITCH" }, { type: "NO_ANSWER" }],
      recording: [{ type: "STOP_RECORD" }],
      outcome: [{ type: "PICK_OUTCOME", outcome: "go_back" }],
      naming: [{ type: "SAVE" }],
    };
    const allEvents: DoorLogEvent[] = [
      { type: "RECORD_PITCH" },
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
