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
  overrides: [],
  disputes: [],
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

describe("what came back", () => {
  const WAITING = {
    id: "d1",
    pitchId: "p1",
    sessionId: "s1",
    repId: "rep1",
    actorId: "rep1",
    itemId: "deliv.tone",
    itemLabel: "Tone and certainty",
    timestampS: 200,
    note: "I was confident the whole way through.",
    filedAt: "2026-09-20T10:00:00.000Z",
    open: true,
    answer: null,
  };
  const ANSWERED = {
    ...WAITING,
    open: false,
    answer: { note: "Listened back — you are right, re-scored.", actorId: "mgr1", answeredAt: "2026-09-20T11:00:00.000Z" },
  };

  it("shows the manager's reply beside the grade it is about", () => {
    render(<PitchDetail pitch={{ ...PITCH, disputes: [ANSWERED] }} />);
    expect(screen.getByText(/Your manager replied/i)).toBeTruthy();
    expect(screen.getByText(/you are right, re-scored/)).toBeTruthy();
  });

  it("says WAITING out loud when there is no reply yet", () => {
    // A dispute shown with no status reads as "nothing happened" — which is what a rep concludes
    // when a complaint disappears, and concluding it once is enough to stop them filing a second.
    render(<PitchDetail pitch={{ ...PITCH, disputes: [WAITING] }} />);
    expect(screen.getByText(/Waiting on your manager/i)).toBeTruthy();
    expect(screen.queryByText(/Your manager replied/i)).toBeNull();
  });

  it("tells the rep the score does not move while they wait", () => {
    render(<PitchDetail pitch={{ ...PITCH, disputes: [WAITING] }} />);
    expect(screen.getByText(/score stays as it is until they respond/i)).toBeTruthy();
  });

  it("names which element the dispute was about", () => {
    render(<PitchDetail pitch={{ ...PITCH, disputes: [WAITING] }} />);
    expect(screen.getByText(/You disputed/)).toBeTruthy();
    expect(screen.getAllByText("Tone and certainty").length).toBeGreaterThan(0);
  });

  it("shows a whole-score dispute as such", () => {
    render(<PitchDetail pitch={{ ...PITCH, disputes: [{ ...WAITING, itemId: null, itemLabel: null }] }} />);
    expect(screen.getByText(/the whole score/)).toBeTruthy();
  });

  it("shows nothing at all when the rep has not disputed anything", () => {
    render(<PitchDetail pitch={PITCH} />);
    expect(screen.queryByText(/Your disputes/i)).toBeNull();
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

describe("corrections a manager made", () => {
  /**
   * The rubric requires the change to be logged. A log the rep cannot read is not a log, so every
   * test here is about a way this section could exist and still leave the rep unable to tell what
   * happened to their score.
   */
  const AWARDED = {
    id: "o1",
    itemType: "bonus" as const,
    itemId: "bonus.directv",
    itemLabel: "Gets inside the house or backyard",
    oldValue: "removed",
    newValue: "awarded",
    reason: "Listened back at 6:10 — they did get inside.",
    actorId: "mgr1",
    appliedAt: "2026-09-20T12:00:00.000Z",
  };
  const FIRST_TIME = {
    ...AWARDED,
    id: "o2",
    itemType: "element" as const,
    itemId: "close.paperwork",
    itemLabel: "Options close",
    oldValue: null,
    newValue: "hit",
    reason: "The AI missed this entirely.",
  };

  /** The corrections section, scoped. The bonus label also renders under "Bonuses earned", so an
   *  unscoped query matches twice and a component that rendered the correction nowhere would still
   *  find text on the page. */
  const correctionsSection = () =>
    screen.getByRole("heading", { name: /A manager (corrected this|made corrections)/i })
      .closest("section")!;

  it("names the item, the reason, and both sides of the change", () => {
    render(<PitchDetail pitch={{ ...PITCH, overrides: [AWARDED] }} />);
    const sec = within(correctionsSection());
    expect(sec.getByText("Gets inside the house or backyard")).toBeTruthy();
    expect(sec.getByText(/they did get inside/)).toBeTruthy();
    expect(sec.getByText("Removed")).toBeTruthy();
    expect(sec.getByText("Awarded")).toBeTruthy();
  });

  it("says the direction in words, not only in colour", () => {
    // A red/green distinction is invisible to roughly one man in twelve, and this row exists to be
    // understood. Both states must be readable as text.
    render(<PitchDetail pitch={{ ...PITCH, overrides: [AWARDED] }} />);
    const sec = correctionsSection();
    const row = within(sec).getByText("Gets inside the house or backyard").closest("li")!;
    expect(within(row).getByText("Removed")).toBeTruthy();
    expect(within(row).getByText("Awarded")).toBeTruthy();
    // The arrow is decorative and hidden from assistive tech; the words carry the meaning. A
    // screen reader gets "changed to" in its place rather than silence.
    expect(within(row).getByText("changed to")).toBeTruthy();
    expect(row.querySelector('[aria-hidden]')?.textContent).toBe("→");
  });

  it("reads the grade in the same words the badges use", () => {
    // Derived from GRADE_STYLE rather than retyped. A component that hard-coded "Hit" would pass
    // this today and drift the moment a grade is renamed — which is why the source derives.
    render(<PitchDetail pitch={{ ...PITCH, overrides: [FIRST_TIME] }} />);
    const row = within(correctionsSection()).getByText("Options close").closest("li")!;
    expect(within(row).getByText("Hit")).toBeTruthy();
  });

  it("reads every grade correctly, not just the one", () => {
    // A single-grade assertion passes against a component that prints "Hit" for all three, which
    // is exactly what a mutation proved. All three, or the derivation is not pinned.
    render(
      <PitchDetail
        pitch={{
          ...PITCH,
          overrides: (["hit", "partial", "missed"] as const).map((g, i) => ({
            ...FIRST_TIME,
            id: `g${i}`,
            itemId: "close.paperwork",
            itemLabel: "Options close",
            newValue: g,
          })),
        }}
      />
    );
    const sec = within(correctionsSection());
    expect(sec.getByText("Hit")).toBeTruthy();
    expect(sec.getByText("Partial")).toBeTruthy();
    expect(sec.getByText("Missed")).toBeTruthy();
  });

  it("says 'Not scored' when the scorer never graded the item at all", () => {
    // The commonest real correction on a short pitch. Rendering a blank where the old value was
    // would read as though something was taken away.
    render(<PitchDetail pitch={{ ...PITCH, overrides: [FIRST_TIME] }} />);
    expect(within(correctionsSection()).getByText("Not scored")).toBeTruthy();
  });

  it("always shows a reason, because one is always required", () => {
    render(<PitchDetail pitch={{ ...PITCH, overrides: [AWARDED, FIRST_TIME] }} />);
    expect(screen.getAllByText(/^Why$/i).length).toBe(2);
    expect(screen.getByText(/The AI missed this entirely/)).toBeTruthy();
  });

  it("tells the rep the score above already includes the correction", () => {
    // Without this line a rep cannot tell whether the number at the top is before or after — and
    // a score they cannot interpret is the thing this whole screen exists to prevent.
    render(<PitchDetail pitch={{ ...PITCH, overrides: [AWARDED] }} />);
    expect(screen.getByText(/already includes these/i)).toBeTruthy();
  });

  it("renders corrections even when the rep never disputed anything", () => {
    // A manager can listen back and correct a pitch nobody disputed. That correction is exactly
    // the one the rep would otherwise never learn about, so it must not be gated on disputes.
    render(<PitchDetail pitch={{ ...PITCH, overrides: [AWARDED], disputes: [] }} />);
    expect(screen.getByRole("heading", { name: /A manager corrected this/i })).toBeTruthy();
  });

  it("uses the plural heading for more than one", () => {
    render(<PitchDetail pitch={{ ...PITCH, overrides: [AWARDED, FIRST_TIME] }} />);
    expect(screen.getByRole("heading", { name: /A manager made corrections/i })).toBeTruthy();
  });

  it("survives a payload from a server that predates overrides", () => {
    // Not hypothetical and not defensive noise. PitchScorePanel obtains this object via
    // `await res.json() as StoredPitch` — a CAST, which is a claim about a network payload, not a
    // guarantee about one. For the length of any rollout, a browser running this code can be
    // served by a server that has never heard of `overrides`, and `undefined.length` throws inside
    // render: the whole score card disappears because a section with nothing to show could not
    // show nothing. Six tests in PitchScorePanel failed exactly this way before the guard.
    const legacy = { ...PITCH } as Partial<StoredPitch>;
    delete legacy.overrides;
    render(<PitchDetail pitch={legacy as StoredPitch} />);
    expect(screen.getByText("80.4")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /A manager (corrected|made)/i })).toBeNull();
  });

  it("shows nothing at all when no manager has touched the pitch", () => {
    render(<PitchDetail pitch={PITCH} />);
    expect(screen.queryByRole("heading", { name: /A manager (corrected|made)/i })).toBeNull();
  });

  it("sits above the section breakdown, so a changed number is explained before it is detailed", () => {
    const { container } = render(<PitchDetail pitch={{ ...PITCH, overrides: [AWARDED] }} />);
    const headings = [...container.querySelectorAll("h3")].map((h) => h.textContent ?? "");
    const correction = headings.findIndex((h) => /A manager corrected/i.test(h));
    const sections = headings.findIndex((h) => /Base by section/i.test(h));
    expect(correction).toBeGreaterThanOrEqual(0);
    expect(correction).toBeLessThan(sections);
  });
});
