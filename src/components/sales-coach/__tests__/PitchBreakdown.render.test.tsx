// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { PitchBreakdown, biggestOpportunity } from "../PitchBreakdown";
// The board consumes the rubric's own lowestSection rather than carrying a copy; these tests
// exercise the authority directly, which is what makes them a guard on the board's behaviour
// rather than on a duplicate that happens to agree.
import { SECTIONS, lowestSection } from "@/lib/coach/pitchScore/rubric";

/**
 * The Breakdown board.
 *
 * Its job is to tell a rep the ONE thing worth practising. Thirty accurate percentages is the
 * same data with the decision handed back, so the tests that matter are about the ranking and
 * about the states that could quietly mislead — a failed load reading as a quiet week, and a
 * "none counted" that does not say why.
 */

const AGG = {
  pitchesTotal: 20,
  counted: 18,
  notCounted: 2,
  notCountedReasons: { "Didn't reach Discovery": 2 },
  totalPoints: 1445,
  avgPitchScore: 80.3,
  avgBase: 68.9,
  avgBonus: 14.6,
  avgViolations: 3.2,
  bestPitchScore: 106.5,
  sectionAverages: {
    introduction: 9.8,
    discovery: 11.2,
    consulting: 10.1,
    close: 8.4,
    transitions: 4.6,
    delivery: 24.8,
  },
  elementStats: [
    { elementId: "close.paperwork", section: "close", label: "Into paperwork", maxPoints: 3, avgPoints: 0.8, hitRate: 0.17, partialRate: 0.2, missedRate: 0.63, gradedIn: 18 },
    { elementId: "deliv.tone", section: "delivery", label: "Tone and certainty", maxPoints: 7, avgPoints: 6.9, hitRate: 0.95, partialRate: 0.05, missedRate: 0, gradedIn: 18 },
  ],
  bonusStats: [{ bonusId: "bonus.directv", label: "Pitch DIRECTV", earnedInRate: 0.56, avgPoints: 2.8 }],
  violationStats: [{ violationId: "viol.talkingOver", label: "Talking over customer", rate: 0.3, avgDeduction: 1.4 }],
  prizeEligible: true,
};

const fetchMock = vi.fn();
const respond = (...rs: { ok: boolean; body?: unknown }[]) => {
  for (const r of rs) fetchMock.mockImplementationOnce(async () => ({ ok: r.ok, json: async () => r.body ?? {} }));
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(cleanup);

describe("ranking the opportunity", () => {
  it("ranks by POINTS lost, not by hit rate", () => {
    // An 8-point element missed half the time costs 4 points a pitch. A 2-point element missed
    // entirely costs 2. Ranking by rate sends the rep after the smaller prize and feels like
    // being nagged about something that barely counts.
    const big = { elementId: "a", section: "close", label: "Big", maxPoints: 8, avgPoints: 4, hitRate: 0.5, partialRate: 0, missedRate: 0.5, gradedIn: 10 } as const;
    const small = { elementId: "b", section: "close", label: "Small", maxPoints: 2, avgPoints: 0, hitRate: 0, partialRate: 0, missedRate: 1, gradedIn: 10 } as const;
    expect(biggestOpportunity([small, big])?.label).toBe("Big");
  });

  it("returns nothing when the remaining gap is rounding", () => {
    // A rep doing well must not be sent to chase a number that cannot move.
    const perfect = { elementId: "a", section: "close", label: "Done", maxPoints: 3, avgPoints: 2.95, hitRate: 1, partialRate: 0, missedRate: 0, gradedIn: 10 } as const;
    expect(biggestOpportunity([perfect])).toBeNull();
  });

  it("returns nothing for an empty period", () => {
    expect(biggestOpportunity([])).toBeNull();
  });
});

describe("the lowest section is by PERCENTAGE, not raw points", () => {
  it("picks the weakest ratio even when another section has fewer points", () => {
    // Verified against the mockups: team Transitions 4.7 is lower in raw points than Close 8.6,
    // and Close is the one badged LOWEST — 57.3% of 15 beats 58.8% of 8.
    const averages = { introduction: 9.8, discovery: 11.2, consulting: 10.1, close: 8.6, transitions: 4.7, delivery: 24.8 } as const;
    expect(lowestSection(averages)).toBe("close");
  });

  it("names a section for every possible input", () => {
    const zeros = Object.fromEntries(SECTIONS.map((s) => [s.id, 0])) as never;
    expect(lowestSection(zeros)).toBeTruthy();
  });
});

describe("states that could mislead", () => {
  it("does NOT show an empty period when the load failed", async () => {
    respond({ ok: false });
    render(<PitchBreakdown />);
    expect(await screen.findByText(/could not be loaded/i)).toBeTruthy();
    expect(screen.queryByText(/No pitches scored/i)).toBeNull();
    expect(screen.getByText(/not the same as having none/i)).toBeTruthy();
  });

  it("says WHY nothing counted, rather than just that nothing did", async () => {
    // "None counted" with no reason reads as the product being broken rather than as a run of
    // short doors.
    respond({
      ok: true,
      body: {
        aggregate: { ...AGG, counted: 0, pitchesTotal: 3, notCounted: 3, notCountedReasons: { "Didn't reach Discovery": 3 } },
        skippedPreVerdict: 0,
      },
    });
    render(<PitchBreakdown />);
    expect(await screen.findByText(/3 pitches, none counted yet/i)).toBeTruthy();
    expect(screen.getByText(/Didn't reach Discovery/)).toBeTruthy();
  });

  it("reports pitches excluded for having no section verdict", async () => {
    respond({ ok: true, body: { aggregate: AGG, skippedPreVerdict: 4 } });
    render(<PitchBreakdown />);
    expect(await screen.findByText(/4 scored before section totals were recorded/i)).toBeTruthy();
  });
});

describe("the board", () => {
  const ready = async () => {
    respond({ ok: true, body: { aggregate: AGG, skippedPreVerdict: 0 } });
    render(<PitchBreakdown />);
    await screen.findByText(/Biggest opportunity/i);
  };

  it("states the opportunity in points the rep can picture, not a percentage", async () => {
    await ready();
    expect(screen.getByText(/Into paperwork: averaging 0.8 of 3/)).toBeTruthy();
    expect(screen.getByText(/adds 2.2 points\s+per pitch/)).toBeTruthy();
    expect(screen.getByText(/about 40 points/)).toBeTruthy();
  });

  it("badges the lowest section by ratio", async () => {
    await ready();
    const close = screen.getByRole("button", { name: /Close/ });
    expect(within(close).getByText("LOWEST")).toBeTruthy();
  });

  it("prints the reconciliation so the rep can check it themselves", async () => {
    // The launch checklist requires base + bonus − violations to equal the displayed average.
    await ready();
    expect(screen.getByText(/68.9 base \+ 14.6 bonus − 3.2 =/)).toBeTruthy();
    expect(screen.getByText("80.3")).toBeTruthy();
  });

  it("opens a section to its per-element rates, with the numbers in words as well as a bar", async () => {
    await ready();
    fireEvent.click(screen.getByRole("button", { name: /Close/ }));
    expect(screen.getByText("Into paperwork")).toBeTruthy();
    expect(screen.getByText(/17% hit · 20% partial · 63% missed/)).toBeTruthy();
  });

  it("says how many pitches each element rate is over", async () => {
    // A rate over 2 pitches and a rate over 200 look identical without it, and one of them is
    // noise the rep should ignore.
    await ready();
    fireEvent.click(screen.getByRole("button", { name: /Close/ }));
    expect(screen.getByText(/in 18 pitches/)).toBeTruthy();
  });

  it("disables a section with no graded elements", async () => {
    await ready();
    expect((screen.getByRole("button", { name: /Discovery/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("re-fetches when the period changes", async () => {
    await ready();
    respond({ ok: true, body: { aggregate: AGG, skippedPreVerdict: 0 } });
    fireEvent.click(screen.getByRole("tab", { name: "Month" }));
    await screen.findByText(/Biggest opportunity/i);
    expect(String(fetchMock.mock.calls.at(-1)![0])).toContain("period=month");
  });

  it("asks for a specific rep when given one", async () => {
    respond({ ok: true, body: { aggregate: AGG, skippedPreVerdict: 0 } });
    render(<PitchBreakdown repId="rep9" />);
    await screen.findByText(/Biggest opportunity/i);
    expect(String(fetchMock.mock.calls[0]![0])).toContain("repId=rep9");
  });
});

/**
 * ONE CALLOUT. Founder ruling 2026-09-22, from the board: page 2 of `EloState Rep Pitch
 * Dashboard.pdf` shows a single amber BIGGEST OPPORTUNITY and then the section bars.
 *
 * Deleted with it: eleven tests over "Most improved" and "Your strongest", and the
 * `strongestElement` unit block. They were good tests of behaviour the board does not have. The
 * ordering assertions in particular — strength above opportunity, improved above strength — were
 * pinning a stack that two closures had already flagged as too dense, which is worth noticing:
 * tests lock in a design decision just as firmly when the decision is wrong.
 */
describe("the board opens with the opportunity and nothing above it", () => {
  it("shows the one callout the board draws", async () => {
    respond({ ok: true, body: { aggregate: AGG, skippedPreVerdict: 0 } });
    const { container } = render(<PitchBreakdown />);
    await screen.findByText(/Biggest opportunity/i);
    expect(screen.getByText(/Into paperwork/)).toBeTruthy();
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/Your strongest/i);
    expect(text).not.toMatch(/Most improved/i);
  });

  it("puts it above the section bars, not after them", async () => {
    respond({ ok: true, body: { aggregate: AGG, skippedPreVerdict: 0 } });
    const { container } = render(<PitchBreakdown />);
    await screen.findByText(/Biggest opportunity/i);
    const text = container.textContent ?? "";
    expect(text.indexOf("Biggest opportunity")).toBeLessThan(text.indexOf("Base score"));
  });
});

describe("a truncated period is said out loud", () => {
  it("warns when the read did not cover the whole period", async () => {
    // Every average on this board is over the pitches that came back. When the bound bites, that
    // is part of a period rather than the period — a different claim from the one they make.
    respond({ ok: true, body: { aggregate: AGG, skippedPreVerdict: 0, capped: true } });
    render(<PitchBreakdown />);
    expect(await screen.findByText(/cover only part of it/i)).toBeTruthy();
    expect(screen.getByText(/shorter period will be complete/i)).toBeTruthy();
  });

  it("says nothing when the period is complete", async () => {
    respond({ ok: true, body: { aggregate: AGG, skippedPreVerdict: 0, capped: false } });
    render(<PitchBreakdown />);
    await screen.findByText(/Biggest opportunity/i);
    expect(screen.queryByText(/cover only part of it/i)).toBeNull();
  });

  it("says nothing when an older server sends no verdict", async () => {
    respond({ ok: true, body: { aggregate: AGG, skippedPreVerdict: 0 } });
    render(<PitchBreakdown />);
    await screen.findByText(/Biggest opportunity/i);
    expect(screen.queryByText(/cover only part of it/i)).toBeNull();
  });
});
