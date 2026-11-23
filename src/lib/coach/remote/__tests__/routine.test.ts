import { describe, it, expect } from "vitest";
import { routineProgress, routineSteps } from "../routine";

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
