import { describe, it, expect } from "vitest";
import { isSalesCall } from "../salesOnly";
import { resolveCoachingMode } from "@/lib/coach/strategy/resolveCoachingMode";

// isSalesCall must give the same answer as the authority it defers to, on every input the authority handles,
// including the missing and unknown kinds where the first version disagreed (2026-10-12, CLAUDE.md §2.2).
describe("isSalesCall", () => {
  const inputs: (string | null | undefined)[] = ["sales", "meeting", "huddle", null, undefined, "", "webinar"];

  it.each(inputs)("agrees with resolveCoachingMode for %s", (kind) => {
    expect(isSalesCall(kind)).toBe(resolveCoachingMode(kind) === "sales");
  });

  it("refuses a meeting and a huddle", () => {
    expect(isSalesCall("meeting")).toBe(false);
    expect(isSalesCall("huddle")).toBe(false);
  });

  it("coaches a missing or unknown kind as sales, as the authority does", () => {
    expect(isSalesCall("sales")).toBe(true);
    expect(isSalesCall(null)).toBe(true);
    expect(isSalesCall(undefined)).toBe(true);
  });
});
