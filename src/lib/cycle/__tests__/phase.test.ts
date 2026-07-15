import { describe, it, expect } from "vitest";
import { resolveCyclePhase, canEnableCoach, phaseLabel } from "../phase";

/**
 * REFERENCE SPEC for the §3.4 cycle-phase resolver (src/lib/cycle/phase.ts), which mirrors
 * SQL function `company_cycle_phase` (migration 0031). Both layers MUST compute the same
 * phase from the same anchor — if the JS drifts from the SQL, the app and DB disagree on
 * whether a company is in CONTROL (Coach locked off, month-1 honest baseline) vs INTERVENTION
 * (Coach may turn on). That disagreement is a §3.4 moat-integrity bug: the whole "month 1 =
 * no AI guidance" honesty claim rests on this boundary being computed identically everywhere.
 *
 * These cases pin the boundaries (day 30, day 60), the control-lock (canEnableCoach=false in
 * month 1 — the actual §3.4 mechanism), the skip path, and the non-negative floor.
 */

const START = "2025-01-01T00:00:00.000Z";
const startMs = Date.parse(START);
const DAY = 24 * 60 * 60 * 1000;
/** `now` at exactly N days past the cycle anchor. */
const atDay = (n: number) => new Date(startMs + n * DAY);

describe("resolveCyclePhase — §3.4 control/intervention/ongoing boundaries", () => {
  it("day 0 → control, and the Coach is LOCKED OFF (the month-1 honest baseline)", () => {
    const d = resolveCyclePhase({ cycleStartedAt: START, now: atDay(0) });
    expect(d.phase).toBe("control");
    expect(canEnableCoach(d)).toBe(false); // §3.4: no AI guidance in month 1
    expect(d.daysIntoCycle).toBe(0);
  });

  it("day 29 is STILL control (the last control day) — Coach still locked", () => {
    const d = resolveCyclePhase({ cycleStartedAt: START, now: atDay(29) });
    expect(d.phase).toBe("control");
    expect(canEnableCoach(d)).toBe(false);
    expect(d.daysRemainingInPhase).toBe(1); // one day left until the day-30 transition
  });

  it("day 30 is the TRANSITION: intervention, Coach may now be enabled", () => {
    const d = resolveCyclePhase({ cycleStartedAt: START, now: atDay(30) });
    expect(d.phase).toBe("intervention");
    expect(canEnableCoach(d)).toBe(true); // §3.4: single-variable intervention begins
  });

  it("day 59 is still intervention; day 60 becomes ongoing", () => {
    expect(resolveCyclePhase({ cycleStartedAt: START, now: atDay(59) }).phase).toBe("intervention");
    const ongoing = resolveCyclePhase({ cycleStartedAt: START, now: atDay(60) });
    expect(ongoing.phase).toBe("ongoing");
    expect(canEnableCoach(ongoing)).toBe(true);
    expect(ongoing.phaseEndsAt).toBeNull(); // no further transition
    expect(ongoing.daysRemainingInPhase).toBe(0);
  });

  it("SKIPPING control jumps straight to intervention even on day 0 — Coach unlockable immediately", () => {
    const d = resolveCyclePhase({
      cycleStartedAt: START,
      cycleControlSkippedAt: START,
      now: atDay(0),
    });
    expect(d.phase).toBe("intervention");
    expect(canEnableCoach(d)).toBe(true);
    expect(d.skippedControl).toBe(true);
  });

  it("a skipped cycle still reaches ongoing at day 60 (skip only bypasses control, not the 60-day mark)", () => {
    const d = resolveCyclePhase({
      cycleStartedAt: START,
      cycleControlSkippedAt: START,
      now: atDay(60),
    });
    expect(d.phase).toBe("ongoing");
  });

  it("daysIntoCycle floors and never goes negative (a future anchor reads as day 0 / control)", () => {
    const d = resolveCyclePhase({ cycleStartedAt: START, now: atDay(-5) });
    expect(d.daysIntoCycle).toBe(0);
    expect(d.phase).toBe("control"); // safe default: locked, not accidentally unlocked
    expect(canEnableCoach(d)).toBe(false);
  });

  it("control phaseEndsAt is the day-30 mark; intervention's is the day-60 mark", () => {
    const control = resolveCyclePhase({ cycleStartedAt: START, now: atDay(10) });
    expect(control.phaseEndsAt).toBe(new Date(startMs + 30 * DAY).toISOString());
    const intervention = resolveCyclePhase({ cycleStartedAt: START, now: atDay(45) });
    expect(intervention.phaseEndsAt).toBe(new Date(startMs + 60 * DAY).toISOString());
  });

  it("phaseLabel names each phase for the UI banners", () => {
    expect(phaseLabel("control")).toMatch(/Month 1.*Control/);
    expect(phaseLabel("intervention")).toMatch(/Month 2/);
    expect(phaseLabel("ongoing")).toMatch(/Compounding/);
  });

  it("INVARIANT: canEnableCoach is false IF AND ONLY IF phase is control (the §3.4 lock)", () => {
    for (const n of [0, 1, 15, 29, 30, 45, 59, 60, 100]) {
      const d = resolveCyclePhase({ cycleStartedAt: START, now: atDay(n) });
      expect(canEnableCoach(d)).toBe(d.phase !== "control");
    }
  });
});
