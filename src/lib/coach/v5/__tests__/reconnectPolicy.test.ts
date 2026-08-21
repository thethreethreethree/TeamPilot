import { describe, it, expect } from "vitest";
import { canAttemptReconnect } from "../reconnectPolicy";

/**
 * The reconnect budget (2026-08-21 capture audit). `attempts` counts CONSECUTIVE failed cycles; a stable
 * (re)connect resets it, so `max` bounds a run of back-to-back failures, not total drops over a long call.
 */
describe("canAttemptReconnect", () => {
  const base = { stopped: false, unmounted: false, attempts: 0, max: 6 };

  it("allows a reconnect while under budget and neither stopped nor unmounted", () => {
    expect(canAttemptReconnect(base)).toBe(true);
    expect(canAttemptReconnect({ ...base, attempts: 5 })).toBe(true);
  });

  it("stops at the budget (attempts === max is spent)", () => {
    expect(canAttemptReconnect({ ...base, attempts: 6 })).toBe(false);
    expect(canAttemptReconnect({ ...base, attempts: 7 })).toBe(false);
  });

  it("never reconnects after an intentional stop or an unmount, even with budget left", () => {
    expect(canAttemptReconnect({ ...base, stopped: true })).toBe(false);
    expect(canAttemptReconnect({ ...base, unmounted: true })).toBe(false);
  });
});
