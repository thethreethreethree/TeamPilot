import { describe, it, expect } from "vitest";
import { summarizeTopicDurability } from "../readoutSummary";

/**
 * §3.5 moat metric: the coach-readout compares COACHED vs UNCOACHED topics on
 * close_durability (held/reopened/partial). That comparison is the "does the Coach change
 * downstream CONSEQUENCE?" measure — the whole "honesty is the moat" claim. This pins the
 * counting so a regression (miscounting held, mislabeling unknown, a bad average) fails CI.
 * Extracted from the route (class 74) precisely so it could be tested here.
 */

const iso = (ms: number) => new Date(ms).toISOString();
// a topic created at t0, closed `hours` later (or open if hours is null)
const topic = (
  id: string,
  status: string,
  durability: string | null,
  createdMs: number,
  closedHours: number | null
) => ({
  id,
  status,
  close_durability: durability,
  created_at: iso(createdMs),
  closed_at: closedHours === null ? null : iso(createdMs + closedHours * 3_600_000),
});

describe("summarizeTopicDurability — §3.5 consequence measure", () => {
  const T0 = Date.UTC(2025, 0, 1);

  it("counts held / reopened / partial exactly", () => {
    const s = summarizeTopicDurability(
      [
        topic("a", "closed", "held", T0, 2),
        topic("b", "closed", "held", T0, 4),
        topic("c", "closed", "reopened", T0, 6),
        topic("d", "closed", "partial", T0, 8),
      ],
      new Map()
    );
    expect(s.held).toBe(2);
    expect(s.reopened).toBe(1);
    expect(s.partial).toBe(1);
    expect(s.closed).toBe(4);
    expect(s.total).toBe(4);
  });

  it("counts 'unknown' as explicit-unknown OR closed-without-a-durability-mark (the review gap)", () => {
    const s = summarizeTopicDurability(
      [
        topic("a", "closed", "unknown", T0, 1), // explicit unknown
        topic("b", "closed", null, T0, 1), // closed but never reviewed → unknown
        topic("c", "open", null, T0, null), // open, no mark → NOT unknown (not closed)
      ],
      new Map()
    );
    expect(s.unknown).toBe(2); // a + b, NOT c
  });

  it("counts an archived-after-close topic by its durable closed_at, not the mutable status (§3.4/§3.5 — the CARE lesson)", () => {
    // The differentiating case: a topic that was closed (closed_at stamped) and LATER
    // archived (status overwritten to 'archived'). The old status==='closed' basis would
    // have dropped it from BOTH `closed` and `unknown` — undercounting the moat metric
    // exactly the way the CARE resolution-rate once did. The durable closed_at is honest.
    const s = summarizeTopicDurability(
      [
        {
          id: "a",
          status: "archived",
          close_durability: null,
          created_at: iso(T0),
          closed_at: iso(T0 + 3_600_000),
        },
      ],
      new Map()
    );
    expect(s.closed).toBe(1); // ever-closed, despite status now 'archived'
    expect(s.unknown).toBe(1); // closed but never durability-reviewed
  });

  it("averages close time in HOURS, ignoring non-positive/open durations", () => {
    const s = summarizeTopicDurability(
      [
        topic("a", "closed", "held", T0, 2), // 2h
        topic("b", "closed", "held", T0, 4), // 4h
        topic("c", "open", null, T0, null), // open → excluded from close-time avg
      ],
      new Map()
    );
    expect(s.avgCloseHours).toBe(3); // (2 + 4) / 2
  });

  it("avgCloseHours is null when nothing has a positive close time", () => {
    const s = summarizeTopicDurability([topic("a", "open", null, T0, null)], new Map());
    expect(s.avgCloseHours).toBeNull();
  });

  it("averages message counts per topic (missing topic id counts as 0)", () => {
    const s = summarizeTopicDurability(
      [topic("a", "closed", "held", T0, 1), topic("b", "closed", "held", T0, 1)],
      new Map([["a", 10]]) // b absent → 0
    );
    expect(s.avgMessages).toBe(5); // (10 + 0) / 2
  });

  it("empty input → all zeros, avgCloseHours null, avgMessages 0 (honest empty, not a crash)", () => {
    const s = summarizeTopicDurability([], new Map());
    expect(s).toEqual({
      total: 0, closed: 0, held: 0, reopened: 0, partial: 0, unknown: 0,
      avgCloseHours: null, avgMessages: 0,
    });
  });
});
