// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

/**
 * The manager dashboard.
 *
 * It exists so a manager can decide who to coach next, so the states that matter are the ones
 * where a wrong reading changes that decision:
 *
 *   · a failed read rendering as a team that did nothing
 *   · a rate over an empty denominator rendering as 0% in a sortable column
 *   · the coaching grade appearing to be the ranking
 *   · an assigned priority section presented as if the brief had named it
 */

vi.mock("@/components/sales-coach/AgentGradeBadge", () => ({
  AgentGradeBadge: ({ agentId }: { agentId?: string }) => <span>grade:{agentId}</span>,
}));
vi.mock("@/components/sales-coach/RepSkillGrades", () => ({
  RepSkillGrades: () => <div>skill grades</div>,
}));

import { CoachAssessmentBoard } from "../CoachAssessmentBoard";

const fetchMock = vi.fn();

const AGG = (over: Record<string, unknown> = {}) => ({
  avgPitchScore: 77,
  avgBase: 67.4,
  avgBonus: 13.1,
  avgViolations: 3.5,
  counted: 75,
  pitchesTotal: 98,
  notCountedReasons: {},
  totalPoints: 5773,
  sectionAverages: { introduction: 9.8, discovery: 11.5, consulting: 8.9, close: 8.6, transitions: 4.7, delivery: 23.9 },
  ...over,
});

const KPIS = (over: Record<string, unknown> = {}) => ({
  doorsKnocked: 671,
  presentations: 98,
  sold: 20,
  doorToPresentationRate: 0.15,
  closeRate: 0.2,
  ...over,
});

const rep = (over: Record<string, unknown> = {}) => ({
  repId: "r1",
  fullName: "John Knudtson",
  avgPitchScore: 87.8,
  band: null,
  totalPoints: 1844,
  doors: 138,
  presentations: 25,
  sold: 8,
  closeRate: 32,
  lowestSection: "transitions",
  lowestSectionLabel: "Transitions",
  coachingGrade: null,
  coachingGradeNote: null,
  focus: "Lock one copper-to-fiber sentence.",
  ...over,
});

const wire = (over: Record<string, unknown> = {}) => ({
  period: "week",
  team: {
    aggregate: AGG(),
    kpis: KPIS(),
    totalPoints: 5773,
    counted: 75,
    pitchesTotal: 98,
    prizeEligible: 4,
    repCount: 5,
    minPitchesForPrize: 5,
  },
  bars: [
    { id: "introduction", label: "Introduction", avg: 9.8, max: 12, lowest: false, pointsLeft: 2.2 },
    { id: "close", label: "The close", avg: 8.6, max: 15, lowest: true, pointsLeft: 6.4 },
  ],
  priorities: [],
  reps: [rep()],
  detail: { r1: { aggregate: AGG({ counted: 9 }), kpis: KPIS() } },
  capped: false,
  unattributed: 0,
  briefGeneratedAt: null,
  ...over,
});

const respond = (body: unknown, ok = true, status = 200) => {
  fetchMock.mockImplementationOnce(async () => ({ ok, status, json: async () => body }));
};
/** The board also fires a best-effort coaching-notes read; answer it with nothing by default. */
const andNotes = (team: unknown[] = []) => {
  fetchMock.mockImplementation(async () => ({ ok: true, status: 200, json: async () => ({ team }) }));
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(cleanup);

describe("a failed read is not a team that did nothing", () => {
  it("says it could not read them", async () => {
    respond({}, false, 500);
    andNotes();
    render(<CoachAssessmentBoard />);
    await screen.findByText(/could not be loaded/i);
    expect(screen.getByText(/not a team that did nothing/i)).toBeTruthy();
    // No zeros anywhere that could read as performance.
    expect(screen.queryByText("Team avg Pitch Score")).toBeNull();
  });

  it("tells a rep this page is not theirs, rather than showing an error", async () => {
    respond({}, false, 403);
    andNotes();
    render(<CoachAssessmentBoard />);
    await screen.findByText(/Managers only/i);
    expect(screen.getByText(/Your own figures are on My Progress/i)).toBeTruthy();
  });
});

describe("the team cards", () => {
  it("shows the average with its components, and counted out of total", async () => {
    respond(wire());
    andNotes();
    render(<CoachAssessmentBoard />);
    // "77" is the team average; the rep detail repeats several card labels, which is the board's
    // own design, so assert on the text unique to the team card.
    expect(await screen.findByText(/67.4 base · \+13.1 bonus · −3.5 violations/)).toBeTruthy();
    expect(screen.getByText("75 of 98")).toBeTruthy();
    expect(screen.getByText("4 of 5")).toBeTruthy();
  });

  it("carries the denominator next to each rate", async () => {
    respond(wire());
    andNotes();
    render(<CoachAssessmentBoard />);
    await screen.findByText(/of 671 doors/);
    // §3.5: a rate without its denominator reads as performance.
    expect(screen.getByText(/of 671 doors/)).toBeTruthy();
    expect(screen.getByText(/of 98 presentations/)).toBeTruthy();
  });

  it("shows an em dash, not 0%, when there is no denominator", async () => {
    respond(wire({ team: { ...wire().team, kpis: KPIS({ doorsKnocked: 0, presentations: 0, sold: 0, doorToPresentationRate: null, closeRate: null }) } }));
    andNotes();
    render(<CoachAssessmentBoard />);
    expect((await screen.findAllByText("Door → presentation")).length).toBeGreaterThan(0);
    expect(screen.queryByText("0%")).toBeNull();
  });

  it("warns when the period was truncated", async () => {
    respond(wire({ capped: true }));
    andNotes();
    render(<CoachAssessmentBoard />);
    expect(await screen.findByText(/cover only part of it/i)).toBeTruthy();
  });

  it("says when scored pitches belong to no rep", async () => {
    respond(wire({ unattributed: 2 }));
    andNotes();
    render(<CoachAssessmentBoard />);
    expect(await screen.findByText(/are not attached to a rep/i)).toBeTruthy();
  });
});

describe("the reps table", () => {
  it("ranks by points and shows the grade as a column, not the order", async () => {
    respond(
      wire({
        reps: [
          rep({ repId: "big", fullName: "Big", totalPoints: 1844, avgPitchScore: 61 }),
          rep({ repId: "small", fullName: "Small", totalPoints: 200, avgPitchScore: 99 }),
        ],
        detail: { big: { aggregate: AGG({ counted: 9 }), kpis: KPIS() }, small: { aggregate: AGG({ counted: 9 }), kpis: KPIS() } },
      })
    );
    andNotes();
    const { container } = render(<CoachAssessmentBoard />);
    await screen.findAllByText("Big");
    const text = container.textContent ?? "";
    // The row order is the ranking; the coaching grade is a column and is not what orders it.
    expect(text.indexOf("Big")).toBeLessThan(text.indexOf("Small"));
    expect(screen.getAllByText(/^grade:/).length).toBeGreaterThan(0);
  });

  it("says the brief has no focus for a rep rather than leaving the cell blank", async () => {
    respond(wire({ reps: [rep({ focus: null })] }));
    andNotes();
    render(<CoachAssessmentBoard />);
    expect(await screen.findByText(/Not in this brief/i)).toBeTruthy();
  });

  it("shows an em dash for a rep with no scored pitch, not a section", async () => {
    respond(wire({ reps: [rep({ lowestSectionLabel: null, closeRate: null })] }));
    andNotes();
    const { container } = render(<CoachAssessmentBoard />);
    await screen.findAllByText("John Knudtson");
    expect((container.textContent ?? "").includes("—")).toBe(true);
  });
});

describe("the priority cards", () => {
  it("says when there is no brief instead of drawing three empty cards", async () => {
    respond(wire({ priorities: [] }));
    andNotes();
    render(<CoachAssessmentBoard />);
    expect(await screen.findByText(/No training brief yet/i)).toBeTruthy();
  });

  it("marks a card whose section was assigned rather than named", async () => {
    respond(
      wire({
        priorities: [
          { rank: 1, section: "close", sectionLabel: "The close", title: "Be bolder", why: "general", teamAvg: 8.6, max: 15, pointsLeft: 6.4, matched: false },
        ],
      })
    );
    andNotes();
    render(<CoachAssessmentBoard />);
    expect(await screen.findByText(/matched by largest gap/i)).toBeTruthy();
  });

  it("does not mark a card the brief actually named", async () => {
    respond(
      wire({
        priorities: [
          { rank: 1, section: "close", sectionLabel: "The close", title: "The close is weak", why: "", teamAvg: 8.6, max: 15, pointsLeft: 6.4, matched: true },
        ],
      })
    );
    andNotes();
    render(<CoachAssessmentBoard />);
    await screen.findByText("The close is weak");
    expect(screen.queryByText(/matched by largest gap/i)).toBeNull();
  });
});

describe("what the rebuild had to keep", () => {
  it("keeps the Generate missing action", async () => {
    // Guide item 4 says to keep it, and it is a manager's only route to sessions that never got
    // a dissect. A rebuild that dropped it would look better and do less.
    respond(wire());
    andNotes();
    render(<CoachAssessmentBoard />);
    expect(await screen.findByRole("button", { name: /Generate missing/i })).toBeTruthy();
  });

  it("names what is NOT in Needs-your-attention rather than showing an empty list", async () => {
    respond(wire());
    andNotes();
    render(<CoachAssessmentBoard />);
    expect(await screen.findByText(/Rude-or-dismissive flags are not wired/i)).toBeTruthy();
  });

  it("keeps the skill scores in rep detail", async () => {
    respond(wire());
    andNotes();
    render(<CoachAssessmentBoard />);
    expect(await screen.findByText("skill grades")).toBeTruthy();
  });

  it("shows coaching notes when the second read returns them", async () => {
    respond(wire());
    andNotes([{ agentId: "r1", agentName: "John", strengths: ["Anchored the visit"], growthAreas: ["Opening got tangled"], strategies: [], dissectCount: 3 }]);
    render(<CoachAssessmentBoard />);
    expect(await screen.findByText("Anchored the visit")).toBeTruthy();
    expect(screen.getByText("Opening got tangled")).toBeTruthy();
  });

  it("says there is no coaching signal rather than leaving the panel blank", async () => {
    respond(wire());
    andNotes([]);
    render(<CoachAssessmentBoard />);
    expect((await screen.findAllByText(/No coaching signal yet/i)).length).toBe(2);
  });
});

describe("the period toggle", () => {
  it("refetches with the chosen period", async () => {
    respond(wire());
    andNotes();
    render(<CoachAssessmentBoard />);
    await screen.findAllByText("77");
    fireEvent.click(screen.getByRole("button", { name: "Month" }));
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes("period=month"))).toBe(true);
  });
});
