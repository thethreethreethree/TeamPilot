import { describe, it, expect } from "vitest";
import { assignmentStatus, currentDue, passedFor } from "../training";

const now = new Date("2026-11-20T12:00:00Z");

describe("training status — one derivation for rep, manager and bell", () => {
  it("due vs overdue with no attempts", () => {
    expect(assignmentStatus({ dueAt: "2026-11-25T00:00:00Z", attempts: [], passScore: 70, now })).toEqual({ state: "due", best: null });
    expect(assignmentStatus({ dueAt: "2026-11-19T00:00:00Z", attempts: [], passScore: 70, now })).toEqual({ state: "overdue", best: null });
  });
  it("with a pass mark: passed once any attempt passes; otherwise not passed yet (even if overdue)", () => {
    const a = (score: number, passed: boolean) => ({ score, applied: true, passed, createdAt: "x" });
    expect(assignmentStatus({ dueAt: "2026-11-19T00:00:00Z", attempts: [a(50, false)], passScore: 70, now })).toEqual({ state: "not_passed_yet", best: 50 });
    expect(assignmentStatus({ dueAt: "2026-11-19T00:00:00Z", attempts: [a(50, false), a(80, true)], passScore: 70, now })).toEqual({ state: "passed", best: 80 });
  });
  it("no pass mark: any attempt is done", () => {
    expect(assignmentStatus({ dueAt: "2026-11-19T00:00:00Z", attempts: [{ score: 40, applied: false, passed: null, createdAt: "x" }], passScore: null, now })).toEqual({ state: "attempted", best: 40 });
  });
  it("the latest due-date change wins; none → the original", () => {
    expect(currentDue("2026-11-25", [])).toBe("2026-11-25");
    expect(currentDue("2026-11-25", [{ due_at: "2026-11-28" }, { due_at: "2026-12-01" }])).toBe("2026-12-01");
  });
  it("passedFor: ≥ mark passes; no mark → null", () => {
    expect(passedFor(70, 70)).toBe(true);
    expect(passedFor(69, 70)).toBe(false);
    expect(passedFor(99, null)).toBeNull();
  });
});
