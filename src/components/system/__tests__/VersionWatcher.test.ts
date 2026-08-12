import { describe, it, expect } from "vitest";
import { shouldForceReload } from "../VersionWatcher";

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
