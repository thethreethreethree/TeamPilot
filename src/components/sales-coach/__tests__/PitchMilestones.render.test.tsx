// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PitchMilestones } from "../PitchMilestones";
import { PITCH_MILESTONE_KEYS, PITCH_MILESTONE_TITLES } from "@/lib/coach/pitchScore/milestones";

/**
 * The milestones strip.
 *
 * Two things here are easy to get wrong in ways that look fine. Hiding unearned badges turns a map
 * into a trophy case — a rep on their first day sees nothing and learns nothing about what there
 * is to reach. And rendering a failed read as six grey badges makes a statement ABOUT THE REP —
 * you have earned nothing — on the strength of a network error.
 */

const NONE = Object.fromEntries(PITCH_MILESTONE_KEYS.map((k) => [k, null]));

const SOME = {
  ...NONE,
  firstPitch: "2026-08-12T10:00:00.000Z",
  inTheDoor: "2026-09-10T10:00:00.000Z",
};

const fetchMock = vi.fn();
const respond = (r: { ok: boolean; body?: unknown }) =>
  fetchMock.mockImplementation(async () => ({ ok: r.ok, json: async () => r.body ?? {} }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(cleanup);

describe("all six badges, always", () => {
  it("renders every milestone even when none is earned", async () => {
    respond({ ok: true, body: { repId: "r1", milestones: NONE, capped: false } });
    render(<PitchMilestones />);
    await screen.findByText(PITCH_MILESTONE_TITLES.firstPitch);
    for (const key of PITCH_MILESTONE_KEYS) {
      expect(screen.getByText(PITCH_MILESTONE_TITLES[key])).toBeTruthy();
    }
  });

  it("does not hide the unearned ones when some are earned", async () => {
    // A trophy case shows what you have. A map shows what there is.
    respond({ ok: true, body: { repId: "r1", milestones: SOME, capped: false } });
    render(<PitchMilestones />);
    await screen.findByText(PITCH_MILESTONE_TITLES.firstPitch);
    expect(screen.getByText(PITCH_MILESTONE_TITLES.century)).toBeTruthy();
    expect(screen.getByText(PITCH_MILESTONE_TITLES.cleanSweep)).toBeTruthy();
  });

  it("says what each badge asks of the rep", async () => {
    respond({ ok: true, body: { repId: "r1", milestones: NONE, capped: false } });
    render(<PitchMilestones />);
    // The sheet's own captions, so an unearned badge is actionable rather than mysterious.
    expect(await screen.findByText(/DTV \+ Wireless \+ ADT in one pitch/i)).toBeTruthy();
    expect(screen.getByText(/Every phase fully hit/i)).toBeTruthy();
    expect(screen.getByText(/100 scored pitches/i)).toBeTruthy();
  });
});

describe("earned and unearned are distinguishable in words", () => {
  it("dates an earned badge", async () => {
    respond({ ok: true, body: { repId: "r1", milestones: SOME, capped: false } });
    render(<PitchMilestones />);
    const row = (await screen.findByText(PITCH_MILESTONE_TITLES.firstPitch)).closest("li")!;
    // Locale-independent: the runtime decides day-month order, so the assertion is that BOTH parts
    // are present and the year is not. Hard-coding "12 Aug" passes in London and fails in Dallas.
    expect(row.textContent).toMatch(/Aug/);
    expect(row.textContent).toContain("12");
    expect(row.textContent).not.toMatch(/2026/);
  });

  it("says 'Not yet' rather than relying on colour", async () => {
    // The only thing separating an earned badge from an unearned one for a reader who cannot see
    // the border, and the only thing a screen reader gets.
    respond({ ok: true, body: { repId: "r1", milestones: SOME, capped: false } });
    render(<PitchMilestones />);
    const row = (await screen.findByText(PITCH_MILESTONE_TITLES.century)).closest("li")!;
    expect(row.textContent).toMatch(/Not yet/);
  });

  it("shows five Not-yets and one date for a rep with one badge", async () => {
    respond({
      ok: true,
      body: { repId: "r1", milestones: { ...NONE, firstPitch: SOME.firstPitch }, capped: false },
    });
    render(<PitchMilestones />);
    await screen.findByText(PITCH_MILESTONE_TITLES.firstPitch);
    expect(screen.getAllByText("Not yet")).toHaveLength(5);
  });

  it("survives a date the browser cannot parse", async () => {
    // A badge with an unreadable date is a badge, not a crash that takes the strip with it.
    respond({ ok: true, body: { repId: "r1", milestones: { ...NONE, firstPitch: "not-a-date" }, capped: false } });
    render(<PitchMilestones />);
    expect(await screen.findByText(PITCH_MILESTONE_TITLES.firstPitch)).toBeTruthy();
  });
});

describe("a failed read is not an empty strip", () => {
  it("says the read failed, and does not render badges", async () => {
    respond({ ok: false });
    render(<PitchMilestones />);
    expect(await screen.findByText(/could not be loaded/i)).toBeTruthy();
    expect(screen.getByText(/not an empty strip/i)).toBeTruthy();
    // Six grey badges would be a claim about the rep made on the strength of a network error.
    expect(screen.queryByText("Not yet")).toBeNull();
  });

  it("offers a retry", async () => {
    respond({ ok: false });
    render(<PitchMilestones />);
    expect(await screen.findByRole("button", { name: /Try again/i })).toBeTruthy();
  });

  it("treats a thrown fetch the same as a bad status", async () => {
    fetchMock.mockImplementation(async () => {
      throw new Error("offline");
    });
    render(<PitchMilestones />);
    expect(await screen.findByText(/could not be loaded/i)).toBeTruthy();
  });
});

describe("whose strip it is", () => {
  it("asks for the caller's own by default", async () => {
    respond({ ok: true, body: { repId: "me", milestones: NONE, capped: false } });
    render(<PitchMilestones />);
    await screen.findByText(PITCH_MILESTONE_TITLES.firstPitch);
    expect(String(fetchMock.mock.calls[0]![0])).not.toContain("repId=");
  });

  it("asks for a named rep when given one", async () => {
    respond({ ok: true, body: { repId: "rep-7", milestones: NONE, capped: false } });
    render(<PitchMilestones repId="rep-7" />);
    await screen.findByText(PITCH_MILESTONE_TITLES.firstPitch);
    expect(String(fetchMock.mock.calls[0]![0])).toContain("repId=rep-7");
  });
});
