// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSubmitLatch } from "../useSubmitLatch";

/**
 * Guard for the double-submit latch (audit 2026-08-19). The finance write handlers were guarded only on
 * disabled={busy} — a render-late flag — so a sub-frame double-click could fire two payment/ledger POSTs. This
 * hook drops the concurrent second call synchronously and resets in finally (a thrown fetch can't wedge it).
 */
describe("useSubmitLatch", () => {
  it("drops a concurrent second call while the first is in flight", async () => {
    const { result } = renderHook(() => useSubmitLatch());
    const run = result.current;
    let calls = 0;
    const fn = () =>
      new Promise<void>((resolve) => {
        calls += 1;
        setTimeout(resolve, 20);
      });
    // Two calls before the first resolves — the second must be dropped.
    const p1 = run(fn);
    const p2 = run(fn);
    await Promise.all([p1, p2]);
    expect(calls).toBe(1);
  });

  it("allows ordinary sequential submits (latch resets after each)", async () => {
    const { result } = renderHook(() => useSubmitLatch());
    const run = result.current;
    let calls = 0;
    const fn = async () => {
      calls += 1;
    };
    await run(fn);
    await run(fn);
    expect(calls).toBe(2);
  });

  it("resets the latch even when fn throws (no permanent wedge)", async () => {
    const { result } = renderHook(() => useSubmitLatch());
    const run = result.current;
    let calls = 0;
    const boom = async () => {
      calls += 1;
      throw new Error("boom");
    };
    await run(boom).catch(() => {});
    await run(boom).catch(() => {});
    expect(calls).toBe(2); // second call still ran — the latch didn't stay shut
  });
});
