import { describe, it, expect } from "vitest";
import {
  isTaskClosed,
  TERMINAL_TASK_STATUSES,
  taskDisplayLabel,
  TASK_CANONICAL_STATUSES,
} from "../statusLabels";

/**
 * isTaskClosed is the single source of truth for "this task is terminal / needs
 * no further attention", used by the task-overrun sweep's TS-side siblings
 * (team-check digest + nudge guard + staleness badge). The class it fixes: a
 * check that only excludes 'Completed' acts on deliberately-CANCELLED work
 * (false task_slipped signals — migration 0184 — nudges, stale badges).
 *
 * These tests lock the terminal set so a later "simplify" can't silently drop
 * 'Cancelled' and reopen the class.
 */
describe("isTaskClosed", () => {
  it("treats BOTH terminal statuses as closed", () => {
    expect(isTaskClosed("Completed")).toBe(true);
    expect(isTaskClosed("Cancelled")).toBe(true);
  });

  it("treats every OPEN workflow status as not closed", () => {
    for (const s of ["To Do", "In Progress", "Blocked", "Needs Review"]) {
      expect(isTaskClosed(s)).toBe(false);
    }
  });

  it("is null/undefined/unknown safe (never throws, defaults to open)", () => {
    expect(isTaskClosed(null)).toBe(false);
    expect(isTaskClosed(undefined)).toBe(false);
    expect(isTaskClosed("")).toBe(false);
    expect(isTaskClosed("Archived")).toBe(false); // not a known terminal status
  });

  it("terminal set is exactly Completed + Cancelled", () => {
    expect([...TERMINAL_TASK_STATUSES].sort()).toEqual(
      ["Cancelled", "Completed"].sort()
    );
  });

  it("every canonical status is either open or Completed — 'Cancelled' is intentionally NOT canonical (source-of-truth split, founder decision)", () => {
    // Guards the documented split: the label/canonical domain omits 'Cancelled'
    // even though isTaskClosed must still recognize it. If someone promotes
    // 'Cancelled' to canonical, this test flips and forces the label decision.
    expect(TASK_CANONICAL_STATUSES).not.toContain("Cancelled");
    // Completed is the one canonical status that is also terminal.
    const canonicalTerminal = TASK_CANONICAL_STATUSES.filter((s) =>
      isTaskClosed(s)
    );
    expect(canonicalTerminal).toEqual(["Completed"]);
  });
});

describe("taskDisplayLabel (unchanged behavior, sanity)", () => {
  it("falls back to the 'To Do' shape for a non-canonical status like 'Cancelled'", () => {
    // A cancelled task has no dedicated label (not canonical); it must not crash.
    expect(taskDisplayLabel("Cancelled").label).toBe(
      taskDisplayLabel("To Do").label
    );
  });
});
