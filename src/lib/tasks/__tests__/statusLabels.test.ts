import { describe, it, expect } from "vitest";
import {
  isTaskClosed,
  TERMINAL_TASK_STATUSES,
  taskDisplayLabel,
  TASK_CANONICAL_STATUSES,
  TASK_STATUS_TRANSITIONS,
  allowedTaskTransitions,
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

describe("TASK_STATUS_TRANSITIONS (shared client+server graph)", () => {
  it("allows the most basic transition an API consumer must make: To Do → In Progress", () => {
    // The regression this guards: the server route once keyed 'New' (phantom) and
    // omitted 'To Do', so it rejected this transition for API/mobile consumers.
    expect(allowedTaskTransitions("To Do")).toContain("In Progress");
  });

  it("allows Needs Review → Completed (server route once omitted the 'Needs Review' key)", () => {
    expect(allowedTaskTransitions("Needs Review")).toContain("Completed");
  });

  it("Completed is terminal (no onward transitions)", () => {
    expect(allowedTaskTransitions("Completed")).toEqual([]);
  });

  it("does NOT use the phantom 'New' status the app never writes", () => {
    expect(TASK_STATUS_TRANSITIONS).not.toHaveProperty("New");
  });

  it("every transition key AND every target is a canonical status (no drift, no 'Cancelled')", () => {
    const canonical = new Set<string>(TASK_CANONICAL_STATUSES);
    for (const [from, targets] of Object.entries(TASK_STATUS_TRANSITIONS)) {
      expect(canonical.has(from)).toBe(true);
      for (const to of targets) {
        expect(canonical.has(to)).toBe(true);
      }
    }
  });

  it("unknown status yields no transitions (never throws)", () => {
    expect(allowedTaskTransitions("Cancelled")).toEqual([]);
    expect(allowedTaskTransitions("Bogus")).toEqual([]);
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
