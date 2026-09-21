// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, within, cleanup } from "@testing-library/react";
import { PitchDetail } from "../PitchDetail";
import type { StoredPitch } from "@/lib/coach/pitchScore/readPitchScore";

/**
 * The screen's job is to explain a number. Every test here is about a way it could fail to.
 *
 * The central one is the reconciliation: on an objection-free pitch, Delivery's element rows are
 * at raw rubric weight while the section total is scaled 27→35. A screen that sums the rows shows
 * a Delivery figure contradicting the score printed at the top of the same page. The fixture is
 * built so those two numbers DISAGREE, so a component that recomputes fails rather than
 * coincidentally matching.
 */

const PITCH: StoredPitch = {
  id: "p1",
  repId: "rep1",
  sessionId: "sess1",
  recordedAt: "2026-09-18T16:12:00.000Z",
  durationS: 660,
  audioUrl: "https://example.test/a.mp3",
  outcome: "sold",
  base: 62.4,
  bonus: 20,
  violations: 2,
  total: 80.4,
  band: "Strong",
  qualifying: true,
  notQualifyingReason: null,
  deliveryScaled: true,
  rubricVersion: "attfiber-v1",
  sectionPoints: [
    { id: "introduction", label: "Introduction", points: 9.5, maxPoints: 12 },
    { id: "discovery", label: "Discovery", points: 12, maxPoints: 16 },
    { id: "consulting", label: "Consulting", points: 8.4, maxPoints: 14 },
    { id: "close", label: "Close", points: 8.6, maxPoints: 15 },
    { id: "transitions", label: "Transitions", points: 4.7, maxPoints: 8 },
    // Scaled. The two Delivery element rows below sum to 7.5, not 19.2.
    { id: "delivery", label: "Delivery", points: 19.2, maxPoints: 35 },
  ],
  elements: [
    { elementId: "intro.trucks", label: "Trucks in the area", section: "introduction", grade: "hit", points: 3, maxPoints: 3, timestampS: 8, evidence: "Named the crews" },
    { elementId: "deliv.tone", label: "Tone and certainty", section: "delivery", grade: "partial", points: 3.5, maxPoints: 7, timestampS: 200, evidence: "Wobbled on price" },
    { elementId: "deliv.pace", label: "Pace", section: "delivery", grade: "hit", points: 4, maxPoints: 4, timestampS: null, evidence: null },
    { elementId: "retired.thing", label: "retired.thing", section: null, grade: "hit", points: 2, maxPoints: null, timestampS: null, evidence: null },
  ],
  events: [
    { type: "bonus", itemId: "bonus.directv", points: 5, timestampS: 482, evidence: "Tied to sports usage", confidence: null },
    { type: "violation", itemId: "viol.talkingOver", points: 2, timestampS: 312, evidence: "Cut in on the deposit question", confidence: null },
    { type: "rejected_bonus", itemId: "bonus.inside", points: 0, timestampS: 130, evidence: "A door, maybe.", confidence: 0.62 },
  ],
};

afterEach(cleanup);

const open = (sectionLabel: string) =>
  fireEvent.click(screen.getByRole("button", { name: new RegExp(sectionLabel) }));

describe("the screen never contradicts the score it is explaining", () => {
  it("shows the STORED Delivery total, not the sum of its element rows", () => {
    render(<PitchDetail pitch={PITCH} />);
    const row = screen.getByRole("button", { name: /Delivery/ });
    expect(within(row).getByText("19.2")).toBeTruthy();
    // The fixture discriminates: re-summing would give 7.5.
    expect(within(row).queryByText("7.5")).toBeNull();
  });

  it("explains the scaling, so a rep who adds the rows up is not left thinking it is broken", () => {
    render(<PitchDetail pitch={PITCH} />);
    expect(screen.getByText(/scaled up/i)).toBeTruthy();
    expect(screen.getByText(/not penalised/i)).toBeTruthy();
  });

  it("says so, rather than guessing, when a pre-0254 pitch has no section verdict", () => {
    render(<PitchDetail pitch={{ ...PITCH, sectionPoints: [] }} />);
    expect(screen.getByText(/scored before section totals were recorded/i)).toBeTruthy();
    // And it does NOT invent section rows from the elements it does have.
    expect(screen.queryByRole("button", { name: /Delivery/ })).toBeNull();
  });
});

describe("the qualifying verdict", () => {
  it("states the REASON a pitch did not count, never a bare 'not counted'", () => {
    render(
      <PitchDetail
        pitch={{ ...PITCH, qualifying: false, notQualifyingReason: "Didn't reach Discovery" }}
      />
    );
    expect(screen.getByText(/Not counted — Didn't reach Discovery/)).toBeTruthy();
  });

  it("confirms it counted when it did", () => {
    render(<PitchDetail pitch={PITCH} />);
    expect(screen.getByText(/Counted toward the leaderboard/)).toBeTruthy();
  });
});

describe("element detail", () => {
  it("opens a section to grade, evidence, moment and points", () => {
    render(<PitchDetail pitch={PITCH} onSeek={vi.fn()} />);
    open("Delivery");
    expect(screen.getByText("Tone and certainty")).toBeTruthy();
    expect(screen.getByText("Wobbled on price")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Play from 3:20" })).toBeTruthy();
    expect(screen.getByText("PARTIAL")).toBeTruthy();
  });

  it("names the grade in WORDS, not only in colour", () => {
    // A red/green distinction is invisible to roughly one man in twelve, and the grade is the
    // entire point of the row.
    render(<PitchDetail pitch={PITCH} />);
    open("Delivery");
    expect(screen.getByText("HIT")).toBeTruthy();
    expect(screen.getByText("PARTIAL")).toBeTruthy();
  });

  it("shows no play control for an element with no timestamp", () => {
    render(<PitchDetail pitch={PITCH} onSeek={vi.fn()} />);
    open("Delivery");
    // deliv.pace has none. An invented timestamp sends the rep to the wrong moment.
    expect(screen.queryByRole("button", { name: /Play from 0:00/ })).toBeNull();
  });

  it("shows the time as plain text, not a dead button, when nothing can play it", () => {
    render(<PitchDetail pitch={PITCH} />); // no onSeek
    open("Delivery");
    expect(screen.queryByRole("button", { name: /^Play from/ })).toBeNull();
    expect(screen.getByText("3:20")).toBeTruthy();
  });

  it("does not open a section that has no graded elements", () => {
    render(<PitchDetail pitch={PITCH} />);
    const row = screen.getByRole("button", { name: /Transitions/ });
    expect((row as HTMLButtonElement).disabled).toBe(true);
  });

  it("accounts for elements from a retired rubric version instead of hiding them", () => {
    // Their points are inside `base`. A hidden row leaves points nothing on screen explains.
    render(<PitchDetail pitch={PITCH} />);
    expect(screen.getByText(/1 element from an older rubric version/i)).toBeTruthy();
  });
});

describe("bonuses, and the ones that were heard but not awarded", () => {
  it("lists an awarded bonus with its evidence and points", () => {
    render(<PitchDetail pitch={PITCH} />);
    expect(screen.getByText("Tied to sports usage")).toBeTruthy();
    expect(screen.getByText("+5")).toBeTruthy();
  });

  it("answers the dispute a rejected bonus would otherwise cause", () => {
    // "The AI didn't see it" is the answer the rubric calls insufficient. This is the other one.
    render(<PitchDetail pitch={PITCH} />);
    expect(screen.getByText(/Heard, not awarded/i)).toBeTruthy();
    expect(screen.getByText(/Only 62% sure/)).toBeTruthy();
  });

  it("omits the section entirely when nothing was rejected", () => {
    render(<PitchDetail pitch={{ ...PITCH, events: PITCH.events.filter((e) => e.type !== "rejected_bonus") }} />);
    expect(screen.queryByText(/Heard, not awarded/i)).toBeNull();
  });
});

describe("dispute", () => {
  it("is not shown at all when disputing is not available", () => {
    // A button that does nothing is worse than no button: the rubric screen already tells reps to
    // tap Dispute, so a dead one confirms the promise and then breaks it.
    render(<PitchDetail pitch={PITCH} />);
    expect(screen.queryByRole("button", { name: /Dispute a score/i })).toBeNull();
  });

  it("hides the PER-ITEM dispute link too, not just the footer button", () => {
    // Found by mutation: the footer was covered and this one was not. It is the same dead-control
    // defect one layer down, and clicking it with no handler would throw in the rep's face.
    render(<PitchDetail pitch={PITCH} />);
    expect(screen.queryByRole("button", { name: /^Dispute$/ })).toBeNull();
  });

  it("files a whole-score dispute with no item", () => {
    const onDispute = vi.fn();
    render(<PitchDetail pitch={PITCH} onDispute={onDispute} />);
    fireEvent.click(screen.getByRole("button", { name: /Dispute a score/i }));
    expect(onDispute).toHaveBeenCalledWith({});
  });

  it("files a rejected bonus with its id and moment, so the manager lands on it", () => {
    const onDispute = vi.fn();
    render(<PitchDetail pitch={PITCH} onDispute={onDispute} />);
    fireEvent.click(screen.getAllByRole("button", { name: /^Dispute$/ })[0]!);
    expect(onDispute).toHaveBeenCalledWith({ itemId: "bonus.inside", timestampS: 130 });
  });

  it("says where a dispute goes and that it is logged", () => {
    render(<PitchDetail pitch={PITCH} onDispute={vi.fn()} />);
    expect(screen.getByText(/Goes to your manager with the timestamp/i)).toBeTruthy();
  });
});

describe("violations", () => {
  it("shows the deduction as a negative, with the evidence", () => {
    render(<PitchDetail pitch={PITCH} />);
    const row = screen.getByText("Cut in on the deposit question").closest("li")!;
    // Scoped to the ROW: "−2" also appears in the score card's Violations stat, so an unscoped
    // query would pass even if the row rendered its deduction as a positive.
    expect(within(row).getByText("−2")).toBeTruthy();
  });

  it("omits the section when there were none", () => {
    render(<PitchDetail pitch={{ ...PITCH, events: [] }} />);
    // Scoped to the HEADING: the score card carries a "Violations" stat label that is always
    // present, so an unscoped text query would pass against a component that renders the list.
    expect(screen.queryByRole("heading", { name: /^Violations$/i })).toBeNull();
    expect(screen.queryByText("Cut in on the deposit question")).toBeNull();
  });
});
