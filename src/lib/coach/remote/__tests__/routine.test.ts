import { describe, it, expect } from "vitest";
import { repRoutineSteps, routineProgress, routineSteps } from "../routine";

describe("routineSteps", () => {
  it("a waiting item is a to-do with its count; zero is done; an unread count is unknown, never done", () => {
    const s = routineSteps({ feedback: 2, disputes: 0, unscored: null, practice: 1 });
    expect(s.map((x) => [x.key, x.state])).toEqual([["feedback", "todo"], ["disputes", "done"], ["unscored", "unknown"], ["practice", "todo"]]);
    expect(s[0]!.detail).toBe("2 reps are waiting for your feedback on a call.");
    expect(s[3]!.detail).toBe("1 assigned practice is past due.");
    expect(s[2]!.detail).toBe("Couldn't check right now.");
    expect(routineProgress(s)).toEqual({ done: 1, checked: 3 });
  });
});

describe("repRoutineSteps", () => {
  it("counts the rep's own to-dos, links the newest call, and never ticks a part that didn't load", () => {
    const s = repRoutineSteps({ practice: 0, answers: 2, waiting: 1, notes: null, answersHref: "/dashboard/remote-sales/calls/s9" });
    expect(s.map((x) => [x.key, x.state])).toEqual([["practice", "done"], ["answers", "todo"], ["notes", "unknown"]]);
    expect(s[1]!.detail).toBe("2 requests were answered this week. 1 request is still waiting.");
    expect(s[1]!.href).toBe("/dashboard/remote-sales/calls/s9");
    expect(s[2]!.detail).toBe("Couldn't check right now.");
    expect(s[2]!.href).toBe("/dashboard/remote-sales");
    expect(routineProgress(s)).toEqual({ done: 1, checked: 2 });
  });
  it("wording for one call without a note, and all clear", () => {
    expect(repRoutineSteps({ practice: 1, answers: 0, waiting: 0, notes: 1 }).map((x) => x.detail)).toEqual([
      "1 practice is still due.",
      "No new answers this week.",
      "1 call this week has no note from you.",
    ]);
  });
});
