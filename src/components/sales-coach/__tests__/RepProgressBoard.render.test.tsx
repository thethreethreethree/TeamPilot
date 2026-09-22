// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import RepProgressBoard from "../RepProgressBoard";
import type { PatternRow } from "@/lib/coach/patterns/readPatterns";
import type { TeamCards, RepProgressRow } from "@/lib/coach/patterns/repProgress";

/**
 * The Rep progress board.
 *
 * Every figure on this screen sits beside a named person, so these tests are about the states
 * where a correct-looking screen would be a false statement about someone:
 *
 *   · "Avg 0.0 days to fix" for a rep who has fixed nothing
 *   · a pill with no reason attached, which is a verdict rather than a mirror (A10 / A11)
 *   · "3/5 → 3/5" printed where there is no history to compare
 *   · a check-in agenda that reads as generated advice rather than as facts on the record
 *   · a button that looks live and does nothing
 */

afterEach(cleanup);

const CARDS: TeamCards = {
  openPatterns: 12,
  acrossReps: 5,
  fixedThisMonth: 6,
  avgDaysToFix: 9.5,
  stalled: 2,
  awaitingRepReview: 1,
  pointsRecovered: 10,
};

const rep = (over: Partial<RepProgressRow> = {}): RepProgressRow => ({
  repId: "r1",
  fullName: "Anthony A.",
  fixed: 1,
  improving: 1,
  stillOpen: 2,
  openTotal: 3,
  attention: "needs_1_1",
  attentionReason: "1 pattern coached over a week ago with no change since",
  ...over,
});

const pattern = (over: Partial<PatternRow> = {}): PatternRow =>
  ({
    id: "p1",
    repId: "r1",
    itemId: "intro.stall",
    itemKind: "element",
    label: "Stalls when the provider assumption is wrong",
    section: "INTRODUCTION",
    firstSeen: "2026-09-10T10:00:00Z",
    missesAtDetection: 3,
    applicableAtDetection: 10,
    costPerPitch: 2.3,
    strip: [],
    coachedAt: "2026-09-11T10:00:00Z",
    fixedAt: null,
    repReviewed: true,
    events: [
      { kind: "coached", at: "2026-09-11T10:00:00Z" },
      { kind: "rep_reviewed", at: "2026-09-12T10:00:00Z" },
    ],
    verdict: {
      status: "stalled",
      open: true,
      reason: "Coached 8 days ago with no improvement",
      streak: 0,
      comparison: { thenMisses: 3, thenOf: 5, nowMisses: 3, nowOf: 5, direction: "flat" },
    },
    daysOpen: 9,
    ...over,
  }) as PatternRow;

const board = (over: { cards?: Partial<TeamCards>; reps?: RepProgressRow[]; patterns?: PatternRow[] } = {}) => (
  <RepProgressBoard
    progress={{ cards: { ...CARDS, ...over.cards }, reps: over.reps ?? [rep()] }}
    patterns={over.patterns ?? [pattern()]}
  />
);

describe("the five team cards", () => {
  it("reproduces the board's row", () => {
    render(board());
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("Across 5 reps")).toBeTruthy();
    expect(screen.getByText("Avg 9.5 days to fix")).toBeTruthy();
    expect(screen.getByText("Coached 7+ days, no change")).toBeTruthy();
    expect(screen.getByText("Coached, clips not opened")).toBeTruthy();
    expect(screen.getByText("+10.0")).toBeTruthy();
  });

  it("says nothing has been fixed rather than printing an average of zero", () => {
    render(board({ cards: { avgDaysToFix: null, fixedThisMonth: 0 } }));
    // Twice — the team card and the rep tile, both refusing to print an average of nothing.
    expect(screen.getAllByText("Nothing fixed yet")).toHaveLength(2);
    expect(screen.queryByText(/Avg 0/)).toBeNull();
  });
});

describe("the rep list", () => {
  it("prints the partition, which is not the total", () => {
    // "1 fixed · 1 improving · 2 open" in the list and "Open patterns 3" in the panel are a
    // partition and a total of the same set. A screen that showed 3 in both would be wrong, and
    // so would one that showed 2 in both.
    render(board());
    expect(screen.getByText("1 fixed · 1 improving · 2 open")).toBeTruthy();
  });

  it("carries the reason behind every pill, in the panel and on the pill", () => {
    // A10 / A11: a judgement printed beside a person's name must be one they could be shown, in
    // the same words, and it must be a fact rather than a trait.
    render(board());
    const pills = screen.getAllByText("Needs 1:1");
    expect(pills.some((p) => p.getAttribute("title")?.includes("coached over a week ago"))).toBe(true);
    expect(screen.getByText(/1 pattern coached over a week ago with no change since/)).toBeTruthy();
  });

  it("switches the panel when another rep is picked", () => {
    render(
      board({
        reps: [rep(), rep({ repId: "r2", fullName: "John Knudtson", attention: "on_track", attentionReason: "Nothing open", fixed: 2, improving: 0, stillOpen: 0, openTotal: 0 })],
        patterns: [pattern(), pattern({ id: "p2", repId: "r2", label: "Talks over the customer", verdict: { status: "fixed", open: false, reason: "5 clean pitches in a row", streak: 5, comparison: null } } as Partial<PatternRow>)],
      })
    );
    fireEvent.click(screen.getByRole("button", { name: /John Knudtson/ }));
    expect(screen.getByText("Nothing open")).toBeTruthy();
  });

  it("pages through the reps with the arrows, as the board does", () => {
    render(
      board({
        reps: [rep(), rep({ repId: "r2", fullName: "John Knudtson" })],
      })
    );
    expect(screen.getByText("Rep 1 of 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Next rep/i }));
    expect(screen.getByText("Rep 2 of 2")).toBeTruthy();
  });
});

describe("the pattern table", () => {
  it("prints misses then → now with a direction", () => {
    render(board());
    const table = screen.getByRole("table");
    // "3/5 → 3/5 →" — unchanged, so the arrow is flat rather than an improvement.
    expect(within(table).getByText(/3\/5\s*→/)).toBeTruthy();
    expect(within(table).getByText("→")).toBeTruthy();
    expect(within(table).queryByText("▼")).toBeNull();
  });

  it("marks a fallen miss rate as an improvement, and a risen one as not", () => {
    const { rerender } = render(
      board({
        patterns: [
          pattern({
            verdict: { ...pattern().verdict, comparison: { thenMisses: 4, thenOf: 5, nowMisses: 1, nowOf: 5, direction: "down" } },
          }),
        ],
      })
    );
    expect(within(screen.getByRole("table")).getByText("▼")).toBeTruthy();

    rerender(
      board({
        patterns: [
          pattern({
            verdict: { ...pattern().verdict, comparison: { thenMisses: 1, thenOf: 5, nowMisses: 4, nowOf: 5, direction: "up" } },
          }),
        ],
      })
    );
    expect(within(screen.getByRole("table")).getByText("▲")).toBeTruthy();
  });

  it("shows a dash instead of 0/5 when there is no history to compare", () => {
    // No data and a perfect record look identical at zero, and only one of them is praise.
    render(board({ patterns: [pattern({ verdict: { ...pattern().verdict, comparison: null } })] }));
    const table = screen.getByRole("table");
    expect(within(table).getAllByText("—").length).toBeGreaterThan(0);
  });

  it("dates the rep's acknowledgement from the event, not from the boolean", () => {
    render(board());
    expect(screen.getByText(/Yes, Sep 12/)).toBeTruthy();
  });

  it("says a pattern was never coached rather than leaving the line blank", () => {
    render(board({ patterns: [pattern({ coachedAt: null, events: [] })] }));
    expect(screen.getByText("Not coached yet")).toBeTruthy();
  });
});

describe("the alert box", () => {
  it("separates 'you coached this and it did not take' from 'nobody has coached this'", () => {
    render(
      board({
        patterns: [
          pattern(),
          pattern({
            id: "p3",
            label: "No spoken yes at hinge moments",
            coachedAt: null,
            events: [],
            firstSeen: "2026-01-01T10:00:00Z",
            daysOpen: 7,
            verdict: { status: "new", open: true, reason: "Detected, not coached yet", streak: 0, comparison: null },
          }),
        ],
      })
    );
    expect(screen.getByText("Stalled:")).toBeTruthy();
    expect(screen.getByText("Waiting on you:")).toBeTruthy();
  });
});

describe("the check-in agenda", () => {
  it("shows the fact behind each item on the screen, not in a tooltip", () => {
    // §3.3: a manager must be able to disagree with an item by disagreeing with a fact. Advice
    // with its reasoning hidden is an assertion about a named person.
    render(board());
    expect(screen.getByText(/Replay one missed clip of/)).toBeTruthy();
    expect(screen.getAllByText(/Coached 8 days ago with no improvement/).length).toBeGreaterThan(0);
  });

  it("says plainly that Schedule check-in is not wired, and disables it", () => {
    // A live-looking button that does nothing is the worse half of an unbuilt feature.
    render(board());
    const btn = screen.getByRole("button", { name: /Schedule check-in/i });
    expect(btn).toHaveProperty("disabled", true);
    expect(screen.getByText(/not wired to a calendar yet/i)).toBeTruthy();
  });

  it("says nothing would be on the agenda when nothing is open", () => {
    render(
      board({
        reps: [rep({ attention: "on_track", attentionReason: "Nothing open", stillOpen: 0, improving: 0, openTotal: 0 })],
        patterns: [
          pattern({
            fixedAt: "2026-09-11T10:00:00Z",
            verdict: { status: "fixed", open: false, reason: "5 clean pitches in a row", streak: 5, comparison: null },
          }),
        ],
      })
    );
    expect(screen.getByText(/nothing this board would put on an agenda/i)).toBeTruthy();
  });
});

describe("fixed patterns", () => {
  it("shows what each recovered, per pitch", () => {
    render(
      board({
        patterns: [
          pattern({
            fixedAt: "2026-09-11T10:00:00Z",
            costPerPitch: 2.3,
            verdict: { status: "fixed", open: false, reason: "5 clean pitches in a row", streak: 5, comparison: null },
          }),
        ],
      })
    );
    expect(screen.getByText("+2.3 pts/pitch")).toBeTruthy();
    expect(screen.getByText(/took 1 day$/)).toBeTruthy();
  });

  it("says nothing fixed yet rather than showing an empty card", () => {
    render(board());
    expect(screen.getByText("Nothing fixed yet.")).toBeTruthy();
  });
});

describe("an empty team", () => {
  it("calls it a finding, not a blank page", () => {
    render(board({ reps: [], patterns: [] }));
    expect(screen.getByText(/No patterns on the team yet/i)).toBeTruthy();
    expect(screen.getByText(/which is a finding, not an empty page/i)).toBeTruthy();
  });
});
