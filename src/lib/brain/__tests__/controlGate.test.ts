import { describe, expect, it } from "vitest";
import { evaluateControlGate } from "../index";

/**
 * §3.4 control-gate boundary tests.
 *
 * This is the month-1 → month-2 honesty boundary: guidance must stay
 * SUPPRESSED during the control window and only turn on when the window
 * elapses or an operator manually unlocks. The dangerous failure is
 * guidance turning on too early (breaks the honest baseline), so the
 * default for any ambiguous/misconfigured input must be "suppressed."
 */
const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000; // fixed reference instant

describe("evaluateControlGate", () => {
  it("suppresses during the control window (unlock in the future)", () => {
    const future = new Date(NOW + 15 * DAY).toISOString();
    const g = evaluateControlGate({
      manualEnabled: false,
      unlockAt: future,
      now: NOW,
    });
    expect(g.guidanceEnabled).toBe(false);
    expect(g.autoUnlocked).toBe(false);
  });

  it("auto-unlocks once the window has elapsed", () => {
    const past = new Date(NOW - DAY).toISOString();
    const g = evaluateControlGate({
      manualEnabled: false,
      unlockAt: past,
      now: NOW,
    });
    expect(g.guidanceEnabled).toBe(true);
    expect(g.autoUnlocked).toBe(true);
  });

  it("enables exactly at the unlock instant (<= boundary)", () => {
    const exact = new Date(NOW).toISOString();
    const g = evaluateControlGate({
      manualEnabled: false,
      unlockAt: exact,
      now: NOW,
    });
    expect(g.guidanceEnabled).toBe(true);
  });

  it("a manual unlock enables even while the window is still open", () => {
    const future = new Date(NOW + 15 * DAY).toISOString();
    const g = evaluateControlGate({
      manualEnabled: true,
      unlockAt: future,
      now: NOW,
    });
    expect(g.guidanceEnabled).toBe(true);
    expect(g.autoUnlocked).toBe(false); // still time-locked; enabled via manual only
  });

  it("fails closed on a null unlock date (no window set → stay suppressed)", () => {
    const g = evaluateControlGate({
      manualEnabled: false,
      unlockAt: null,
      now: NOW,
    });
    expect(g.guidanceEnabled).toBe(false);
    expect(g.autoUnlocked).toBe(false);
  });

  it("fails closed on a malformed unlock date (NaN <= now is false)", () => {
    const g = evaluateControlGate({
      manualEnabled: false,
      unlockAt: "not-a-date",
      now: NOW,
    });
    expect(g.guidanceEnabled).toBe(false);
    expect(g.autoUnlocked).toBe(false);
  });
});
