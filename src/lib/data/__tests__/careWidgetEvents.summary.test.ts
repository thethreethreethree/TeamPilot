import { describe, it, expect } from "vitest";
import {
  summarizeLoadEvents,
  type WidgetLoadEvent,
} from "../careWidgetEvents";

const ev = (
  result: WidgetLoadEvent["result"],
  origin: string | null = null,
  id = Math.random().toString(36).slice(2)
): WidgetLoadEvent => ({ id, origin, result, userAgent: null, createdAt: "2026-07-24T00:00:00Z" });

describe("summarizeLoadEvents", () => {
  it("counts ok vs origin_rejected and collects distinct rejected origins", () => {
    const s = summarizeLoadEvents([
      ev("ok"),
      ev("ok"),
      ev("origin_rejected", "https://evil.com"),
      ev("origin_rejected", "https://evil.com"), // dup origin → collected once
      ev("origin_rejected", "https://other-bad.com"),
      ev("quota_exceeded"),
    ]);
    expect(s.total).toBe(6);
    expect(s.okCount).toBe(2);
    expect(s.rejectedCount).toBe(3);
    // Distinct, so an admin sees WHICH origins are abusing the token, not a noisy repeat.
    expect(s.rejectedOrigins).toEqual(["https://evil.com", "https://other-bad.com"]);
  });

  it("ignores blank/null origins on rejected events", () => {
    const s = summarizeLoadEvents([ev("origin_rejected", null), ev("origin_rejected", "  ")]);
    expect(s.rejectedCount).toBe(2);
    expect(s.rejectedOrigins).toEqual([]);
  });

  it("handles an empty event list", () => {
    expect(summarizeLoadEvents([])).toEqual({
      events: [],
      total: 0,
      okCount: 0,
      rejectedCount: 0,
      rejectedOrigins: [],
    });
  });
});
