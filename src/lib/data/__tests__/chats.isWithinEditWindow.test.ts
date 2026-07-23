import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isWithinEditWindow, MESSAGE_EDIT_WINDOW_MS } from "../chats";

/**
 * Locks the §3.1 edit-window exception. Team Chat messages become mutable ONLY
 * within MESSAGE_EDIT_WINDOW_MS of creation (the same boundary the DB enforces
 * in migration 0068 RLS); this client-side mirror shows/hides the edit affordance
 * so the user never sees an option the server will deny. If the boundary drifted
 * open, immutability (§3.1) would erode on the client; if it drifted closed, the
 * affordance would vanish while the server still allowed the edit. Deterministic
 * via fake timers so the <= boundary can't be flaky.
 */
describe("isWithinEditWindow — §3.1 edit-window boundary", () => {
  const NOW = new Date("2026-07-23T12:00:00.000Z").getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const ago = (ms: number) => new Date(NOW - ms).toISOString();

  it("a message created now is editable", () => {
    expect(isWithinEditWindow(new Date(NOW).toISOString())).toBe(true);
  });

  it("well inside the window (10 min ago) is editable", () => {
    expect(isWithinEditWindow(ago(10 * 60 * 1000))).toBe(true);
  });

  it("exactly at the window edge is STILL editable (<= boundary, inclusive)", () => {
    expect(isWithinEditWindow(ago(MESSAGE_EDIT_WINDOW_MS))).toBe(true);
  });

  it("one millisecond past the edge is NOT editable", () => {
    expect(isWithinEditWindow(ago(MESSAGE_EDIT_WINDOW_MS + 1))).toBe(false);
  });

  it("well past the window (31 min ago) is NOT editable", () => {
    expect(isWithinEditWindow(ago(31 * 60 * 1000))).toBe(false);
  });

  it("an unparseable timestamp is NOT editable (NaN guard — never open the affordance on bad data)", () => {
    expect(isWithinEditWindow("not-a-date")).toBe(false);
    expect(isWithinEditWindow("")).toBe(false);
  });

  it("the window constant is the documented 30 minutes", () => {
    expect(MESSAGE_EDIT_WINDOW_MS).toBe(30 * 60 * 1000);
  });
});
