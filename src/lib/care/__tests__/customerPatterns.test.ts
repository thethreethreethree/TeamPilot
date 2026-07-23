import { describe, it, expect } from "vitest";
import {
  aggregateCustomerPatterns,
  CUSTOMER_PATTERN_MIN_CONVERSATIONS,
  type CustomerPatternRow,
} from "../customerPatterns";

const row = (resolvedAt: string | null, handoffTopic: string | null): CustomerPatternRow => ({
  resolvedAt,
  handoffTopic,
});

describe("aggregateCustomerPatterns", () => {
  it("withholds patterns below the §3.2 threshold (enoughData=false)", () => {
    const out = aggregateCustomerPatterns([row("2026-01-01", "refund"), row(null, "billing")]);
    expect(out.totalConversations).toBe(2);
    expect(out.enoughData).toBe(false); // 2 < 3
  });

  it("surfaces once the threshold is met", () => {
    const rows = Array.from({ length: CUSTOMER_PATTERN_MIN_CONVERSATIONS }, () =>
      row(null, "refund")
    );
    expect(aggregateCustomerPatterns(rows).enoughData).toBe(true);
  });

  it("counts resolved by the DURABLE resolved_at, not by any status (§3.5)", () => {
    const out = aggregateCustomerPatterns([
      row("2026-01-01", "refund"),
      row(null, "refund"),
      row("2026-02-01", "billing"),
    ]);
    expect(out.totalConversations).toBe(3);
    expect(out.resolvedConversations).toBe(2);
  });

  it("counts concern topics and returns the top 3, count-desc then topic-asc", () => {
    const out = aggregateCustomerPatterns([
      row(null, "refund"),
      row(null, "refund"),
      row(null, "refund"),
      row(null, "billing"),
      row(null, "billing"),
      row(null, "shipping"),
      row(null, "other"),
    ]);
    expect(out.topConcerns).toEqual([
      { topic: "refund", count: 3 },
      { topic: "billing", count: 2 },
      // shipping vs other both count 1 → topic-asc breaks the tie deterministically
      { topic: "other", count: 1 },
    ]);
  });

  it("ignores blank/whitespace topics and never emits a verdict field", () => {
    const out = aggregateCustomerPatterns([row(null, ""), row(null, "   "), row(null, null)]);
    expect(out.topConcerns).toEqual([]);
    // Shape is counts-only (A11): no verdict/label/sentiment keys.
    expect(Object.keys(out).sort()).toEqual([
      "enoughData",
      "resolvedConversations",
      "topConcerns",
      "totalConversations",
    ]);
  });

  it("handles the empty (anonymous / no data) case honestly", () => {
    const out = aggregateCustomerPatterns([]);
    expect(out).toEqual({
      totalConversations: 0,
      resolvedConversations: 0,
      topConcerns: [],
      enoughData: false,
    });
  });
});
