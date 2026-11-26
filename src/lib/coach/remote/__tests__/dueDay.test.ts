import { describe, it, expect } from "vitest";
import { dayOf, dueEndOfDay } from "../dueDay";

/** A picked day is the end of that day in the viewer's own time, and reads back as the same day. */
describe("due days", () => {
  it("round-trips the picked day in local time", () => {
    const iso = dueEndOfDay("2026-12-01");
    expect(new Date(iso).getHours()).toBe(23);
    expect(dayOf(iso)).toBe("2026-12-01");
  });
});
