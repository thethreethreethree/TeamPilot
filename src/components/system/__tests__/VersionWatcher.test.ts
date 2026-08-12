import { describe, it, expect } from "vitest";
import { shouldForceReload, hasTriedCommit, markTriedCommit } from "../VersionWatcher";

/**
 * shouldForceReload is the safety-critical core of the forced auto-update (founder 2026-08-13). The component
 * itself can't be unit-tested (node env), so the DECISION is extracted here. Each `false` case is a real safety
 * property; the one `true` case is the actual force. A regression that flips any of these could silently ship a
 * reload loop (guard 2) or interrupt a live call (guard 1), so they are locked.
 */
describe("shouldForceReload — the forced-update decision", () => {
  const base = { baked: "aaa", live: "bbb", alreadyTriedThisCommit: false, recordingActive: false };

  it("reloads when stale, not recording, and not already tried (the force)", () => {
    expect(shouldForceReload(base)).toBe(true);
  });

  it("does NOT reload when the commits match (already current)", () => {
    expect(shouldForceReload({ ...base, live: "aaa" })).toBe(false);
  });

  it("does NOT reload when the baked commit is empty (local / off-Vercel build)", () => {
    expect(shouldForceReload({ ...base, baked: "" })).toBe(false);
  });

  it("does NOT reload when the live commit is empty (health didn't report one)", () => {
    expect(shouldForceReload({ ...base, live: "" })).toBe(false);
  });

  it("GUARD 1 — does NOT reload while a call is recording (never interrupt a live recording)", () => {
    expect(shouldForceReload({ ...base, recordingActive: true })).toBe(false);
  });

  it("GUARD 2 — does NOT reload if we already reloaded for THIS commit and are still stale (no loop)", () => {
    expect(shouldForceReload({ ...base, alreadyTriedThisCommit: true })).toBe(false);
  });

  it("a NEW deploy after a failed reload IS eligible again (alreadyTried was keyed to the old commit)", () => {
    // The component keys alreadyTried on the live commit; a different live commit → not-yet-tried → force again.
    expect(shouldForceReload({ ...base, live: "ccc", alreadyTriedThisCommit: false })).toBe(true);
  });
});

/**
 * hasTriedCommit / markTriedCommit are the EXECUTION that feeds shouldForceReload's `alreadyTriedThisCommit`
 * (the decision above is tested with that flag as an input; these test how it's actually computed from storage).
 * The load-bearing property is loop-prevention: a reload writes the live commit, so a return trip STILL stale for
 * the same commit reads back true and stops. A regression here (wrong compare, or a throw that reads as
 * not-tried) would let a persistently-drifted client reload forever, so the fail-safe (throw → tried) is locked.
 */
describe("recording/reload loop-guard execution (hasTriedCommit / markTriedCommit)", () => {
  const makeStorage = (initial: Record<string, string> = {}) => {
    const map = new Map(Object.entries(initial));
    return {
      getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
      setItem: (k: string, v: string) => void map.set(k, v),
      _map: map,
    };
  };

  it("first time for a commit → not tried (nothing stored yet)", () => {
    expect(hasTriedCommit(makeStorage(), "k", "commitA")).toBe(false);
  });

  it("after markTriedCommit, the SAME commit reads back as tried (the loop is broken on a return trip)", () => {
    const s = makeStorage();
    markTriedCommit(s, "k", "commitA");
    expect(hasTriedCommit(s, "k", "commitA")).toBe(true);
  });

  it("a DIFFERENT commit is not tried even after a prior commit was recorded (a new deploy is eligible)", () => {
    const s = makeStorage({ k: "commitA" });
    expect(hasTriedCommit(s, "k", "commitB")).toBe(false);
  });

  it("no storage → treated as tried (fail-safe: do NOT auto-reload; manual banner remains)", () => {
    expect(hasTriedCommit(undefined, "k", "commitA")).toBe(true);
    expect(hasTriedCommit(null, "k", "commitA")).toBe(true);
  });

  it("storage that THROWS on read → treated as tried (fail-safe, never a loop)", () => {
    const throwing = {
      getItem: () => {
        throw new Error("SecurityError: sessionStorage blocked");
      },
    };
    expect(hasTriedCommit(throwing, "k", "commitA")).toBe(true);
  });

  it("markTriedCommit never throws when storage is absent or write-blocked (best-effort)", () => {
    expect(() => markTriedCommit(undefined, "k", "commitA")).not.toThrow();
    const throwing = {
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(() => markTriedCommit(throwing, "k", "commitA")).not.toThrow();
  });
});
