import { describe, it, expect, vi, afterEach } from "vitest";
import { hapticTap, hapticSend, hapticSuccess, hapticWarning, hapticThreshold } from "../haptics";

/**
 * Haptic wrappers. The load-bearing CONTRACT (per the module header): all are silent no-ops when
 * navigator.vibrate is unavailable, so callers use them unconditionally without environment checks — a missing
 * guard would crash the calling action on iOS/SSR/desktop. Also pins the intent→duration mapping (the durations
 * are centralized here; a regression swapping them = wrong physical feedback).
 */

const fns = [hapticTap, hapticSend, hapticSuccess, hapticWarning, hapticThreshold];

afterEach(() => vi.unstubAllGlobals());

describe("haptics — safe no-op when unsupported", () => {
  it("never throws when navigator.vibrate is absent (default node env / SSR / desktop)", () => {
    for (const f of fns) expect(() => f()).not.toThrow();
  });

  it("never throws when navigator.vibrate throws (throttled)", () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", {
      vibrate: () => {
        throw new Error("throttled");
      },
    });
    for (const f of fns) expect(() => f()).not.toThrow();
  });
});

describe("haptics — intent → duration mapping", () => {
  it("each semantic function vibrates with its intended pattern", () => {
    const vibrate = vi.fn();
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", { vibrate });

    hapticThreshold();
    hapticTap();
    hapticSend();
    hapticWarning();
    hapticSuccess();

    expect(vibrate.mock.calls.map((c) => c[0])).toEqual([
      5, // threshold — lightest
      10, // tap
      20, // send
      50, // warning — heaviest single
      [20, 30, 20], // success — double-tap pattern
    ]);
  });
});
