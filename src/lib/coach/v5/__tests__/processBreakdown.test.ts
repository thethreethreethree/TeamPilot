import { describe, it, expect } from "vitest";
import { parseProcessBreakdown, aggregateProcessBreakdown } from "../processBreakdown";
import type { ProcessPhase } from "../summaryTypes";

describe("parseProcessBreakdown", () => {
  it("parses the four phases in canonical order with clamped scores + grounded (trimmed) citations", () => {
    const out = parseProcessBreakdown(
      JSON.stringify({
        phases: [
          { key: "close", score: 12, tip: "Ask for a specific next step", citation: "so, next week?" },
          { key: "intro", score: 8, tip: "Great rapport — keep it", citation: "how's the family" },
          { key: "discovery", score: 4, tip: "Ask more open questions", citation: "" },
        ],
      }),
    );
    expect(out.map((p) => p.key)).toEqual(["intro", "discovery", "close"]); // canonical order, consultation absent
    expect(out.find((p) => p.key === "close")!.score).toBe(10); // clamped from 12
    expect(out.find((p) => p.key === "discovery")!.citation).toBeNull(); // empty citation → null
    expect(out.find((p) => p.key === "intro")!.label).toBe("Intro & rapport");
  });

  it("drops a phase with NO tip (A11 — no naked verdict) and an unknown phase key", () => {
    const out = parseProcessBreakdown(
      JSON.stringify({ phases: [{ key: "close", score: 9 }, { key: "warmup", score: 8, tip: "x" }] }),
    );
    expect(out).toEqual([]); // close has no tip; 'warmup' isn't a real phase
  });

  it("a phase that didn't happen keeps a null score (never a fabricated 0) but its tip", () => {
    const out = parseProcessBreakdown(
      JSON.stringify({ phases: [{ key: "close", score: null, tip: "You never asked — end with an ask" }] }),
    );
    expect(out[0]).toMatchObject({ key: "close", score: null, tip: "You never asked — end with an ask" });
  });

  it("invalid JSON → [] (honest empty, not a crash)", () => {
    expect(parseProcessBreakdown("not json")).toEqual([]);
    expect(parseProcessBreakdown(JSON.stringify({ nope: 1 }))).toEqual([]);
  });
});

const phase = (key: ProcessPhase["key"], score: number | null, tip: string): ProcessPhase => ({
  key,
  label: key,
  score,
  tip,
  citation: null,
});

describe("aggregateProcessBreakdown", () => {
  it("averages a phase over sessions where it was graded, and takes the tip from the WEAKEST session", () => {
    const agg = aggregateProcessBreakdown([
      [phase("discovery", 8, "solid questions")],
      [phase("discovery", 4, "ask more open questions")], // weakest → its tip wins
      [phase("discovery", 6, "good follow-ups")],
    ]);
    const d = agg.find((a) => a.key === "discovery")!;
    expect(d.avg).toBe(6); // (8+4+6)/3
    expect(d.samples).toBe(3);
    expect(d.tip).toBe("ask more open questions"); // from the score=4 session
  });

  it("an absent phase (null score) never drags the average, but still contributes its tip", () => {
    const agg = aggregateProcessBreakdown([
      [phase("close", 8, "clean close")],
      [phase("close", null, "you skipped the close — add an ask")], // not scored
    ]);
    const c = agg.find((a) => a.key === "close")!;
    expect(c.avg).toBe(8); // only the scored session counts
    expect(c.samples).toBe(1);
  });

  it("omits a phase with no data across all sessions", () => {
    const agg = aggregateProcessBreakdown([[phase("intro", 7, "good open")]]);
    expect(agg.map((a) => a.key)).toEqual(["intro"]); // no discovery/consultation/close anywhere
  });

  it("empty input → []", () => {
    expect(aggregateProcessBreakdown([])).toEqual([]);
    expect(aggregateProcessBreakdown([[], []])).toEqual([]);
  });
});
