import { describe, it, expect } from "vitest";
import { repChips, teamWidePatterns, type PatternRow } from "../readPatterns";
import type { StatusVerdict } from "../status";

/**
 * The manager board's two team aggregations.
 *
 * Both exist to be counted ONCE, from the verdicts, so the numbers on screen agree. The chip row
 * sits directly under the ACTIVE PATTERNS card and a manager reads them together — C8 is the
 * record of what happens when two surfaces each decide for themselves what "open" means.
 */

const v = (status: StatusVerdict["status"], open: boolean): StatusVerdict => ({
  status,
  open,
  reason: "",
  streak: 0,
  comparison: null,
});

const row = (repId: string, itemId: string, verdict: StatusVerdict): PatternRow =>
  ({
    id: `${repId}-${itemId}`,
    repId,
    itemId,
    itemKind: "element",
    label: itemId,
    section: "introduction",
    firstSeen: "2026-03-01T10:00:00Z",
    missesAtDetection: 3,
    applicableAtDetection: 5,
    costPerPitch: 2,
    strip: [],
    coachedAt: null,
    fixedAt: null,
    repReviewed: false,
    events: [],
    verdict,
    daysOpen: 1,
  }) as PatternRow;

describe("repChips", () => {
  it("counts OPEN patterns per rep, consuming the verdict", () => {
    const chips = repChips([
      row("a", "x", v("new", true)),
      row("a", "y", v("improving", true)),
      row("a", "z", v("fixed", false)),
      row("b", "x", v("coaching", true)),
    ]);
    expect(chips).toEqual([
      { repId: "a", open: 2 },
      { repId: "b", open: 1 },
    ]);
  });

  it("counts Improving IN, so the chips sum to the ACTIVE PATTERNS card", () => {
    // Anthony A.'s chip reads 3 on the board while his rep-progress line reads "2 open". Both are
    // right and they are different questions; the chip is the one that includes Improving.
    const rows = [
      row("a", "x", v("new", true)),
      row("a", "y", v("stalled", true)),
      row("a", "z", v("improving", true)),
      row("a", "w", v("fixed", false)),
    ];
    expect(repChips(rows)[0]!.open).toBe(3);
  });

  it("sorts by count, then by id so the row does not reshuffle between loads", () => {
    const chips = repChips([
      row("zed", "x", v("new", true)),
      row("amy", "x", v("new", true)),
      row("bob", "x", v("new", true)),
      row("bob", "y", v("new", true)),
    ]);
    expect(chips.map((c) => c.repId)).toEqual(["bob", "amy", "zed"]);
  });

  it("omits a rep whose patterns are all fixed rather than showing a zero", () => {
    expect(repChips([row("a", "x", v("fixed", false))])).toEqual([]);
  });

  it("has nothing to say about nobody", () => {
    expect(repChips([])).toEqual([]);
  });
});

describe("teamWidePatterns", () => {
  it("promotes an item when 3+ reps have it OPEN", () => {
    const t = teamWidePatterns([
      row("a", "deliv.spokenYes", v("new", true)),
      row("b", "deliv.spokenYes", v("coaching", true)),
      row("c", "deliv.spokenYes", v("improving", true)),
    ]);
    expect(t).toHaveLength(1);
    expect(t[0]!.repIds).toHaveLength(3);
  });

  it("does not promote at two", () => {
    expect(
      teamWidePatterns([
        row("a", "deliv.spokenYes", v("new", true)),
        row("b", "deliv.spokenYes", v("new", true)),
      ])
    ).toEqual([]);
  });

  it("counts REPS, not patterns — one rep with two patterns on an item counts once", () => {
    // The reason this is a Set. Without it, a rep who fixed an item and re-opened it would push
    // a team-wide banner on their own, and a manager would be told to run a team session about
    // one person.
    const t = teamWidePatterns([
      row("a", "deliv.spokenYes", v("new", true)),
      { ...row("a", "deliv.spokenYes", v("coaching", true)), id: "dup" },
      row("b", "deliv.spokenYes", v("new", true)),
    ]);
    expect(t).toEqual([]);
  });

  it("ignores fixed patterns, because a team gap that everyone fixed is not a gap", () => {
    expect(
      teamWidePatterns([
        row("a", "x", v("fixed", false)),
        row("b", "x", v("fixed", false)),
        row("c", "x", v("fixed", false)),
      ])
    ).toEqual([]);
  });

  it("ranks the widest first", () => {
    const t = teamWidePatterns([
      ...["a", "b", "c"].map((r) => row(r, "narrow", v("new", true))),
      ...["a", "b", "c", "d"].map((r) => row(r, "wide", v("new", true))),
    ]);
    expect(t.map((x) => x.itemId)).toEqual(["wide", "narrow"]);
  });
});
