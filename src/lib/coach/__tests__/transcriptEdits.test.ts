import { describe, it, expect } from "vitest";
import { cleanLine, editMarks, type EditRow } from "../transcriptEdits";

const e = (seq: number, from: number, to: number, at = `2026-11-23T0${to}:00:00Z`): EditRow => ({ seq, from_version: from, to_version: to, edited_by: "u1", created_at: at });

describe("editMarks", () => {
  const text: Record<string, string> = { "1:1": "fifty", "2:1": "fifteen", "3:1": "fifteen a month", "1:2": "hi", "2:2": "hi" };
  const at = (v: number, s: number) => text[`${v}:${s}`];

  it("marks a corrected line with the words before the FIRST correction and the count", () => {
    const m = editMarks([e(1, 1, 2), e(1, 2, 3)], at, new Map([[1, "fifteen a month"], [2, "hi"]]));
    expect(m).toEqual([{ seq: 1, original: "fifty", editedAt: "2026-11-23T03:00:00Z", editedBy: "u1", count: 2 }]);
  });
  it("no mark once the line no longer holds the latest correction (re-transcribed later)", () => {
    expect(editMarks([e(1, 1, 2)], at, new Map([[1, "something else entirely"]]))).toEqual([]);
  });
  it("no mark when the line is gone (trimmed) or was corrected back to the original", () => {
    expect(editMarks([e(1, 1, 2)], at, new Map())).toEqual([]);
    expect(editMarks([e(2, 1, 2)], at, new Map([[2, "hi"]]))).toEqual([]);
  });
});

describe("cleanLine", () => {
  it("trims and bounds", () => {
    expect(cleanLine("  fifteen  ")).toBe("fifteen");
    expect(cleanLine("   ")).toBeNull();
    expect(cleanLine("x".repeat(4001))).toBeNull();
    expect(cleanLine(5)).toBeNull();
  });
});
