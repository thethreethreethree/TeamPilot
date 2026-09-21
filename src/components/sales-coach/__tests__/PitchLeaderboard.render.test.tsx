// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { PitchLeaderboard } from "../PitchLeaderboard";
import { PRIZE_ELIGIBLE_MIN_PITCHES } from "@/lib/coach/pitchScore/rubric";

/**
 * The competition board.
 *
 * The state that matters most is the one that looks harmless: a FAILED read rendering as "nobody
 * has scored yet". A manager acts on that by concluding the team did nothing — the worst possible
 * response to a board that merely failed to load.
 *
 * The second is the rep view. A rendering bug that showed the field to a rep would breach the
 * KPI-System rule that cross-agent ranking is manager-only, and the service-role route means the
 * database is no longer there to stop it.
 */

const row = (over: Partial<Record<string, unknown>> = {}) => ({
  repId: "r1",
  fullName: "Ada Vance",
  total_points: 180,
  counted: 3,
  pitchesTotal: 4,
  avgPitchScore: 60,
  bestPitchScore: 70,
  prizeEligible: false,
  rank: 1,
  ...over,
});

const MANAGER = {
  period: "week",
  managerView: true,
  rows: [
    row(),
    row({ repId: "r2", fullName: "Bo Iqbal", total_points: 120, rank: 2, counted: 6, pitchesTotal: 6, prizeEligible: true }),
  ],
  meId: "r2",
  standing: { repId: "r2", total_points: 120, counted: 6, pitchesTotal: 6, avgPitchScore: 20, bestPitchScore: 40, prizeEligible: true, rank: 2 },
  boardSize: 2,
  skippedPreVerdict: 0,
};

const REP = {
  period: "week",
  managerView: false,
  standing: { repId: "me", total_points: 70, counted: 2, pitchesTotal: 3, avgPitchScore: 35, bestPitchScore: 40, prizeEligible: false, rank: 3 },
  boardSize: 9,
  skippedPreVerdict: 0,
};

const fetchMock = vi.fn();
const respond = (r: { ok: boolean; body?: unknown }) =>
  fetchMock.mockImplementation(async () => ({ ok: r.ok, json: async () => r.body ?? {} }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(cleanup);

describe("empty and failed are different", () => {
  it("says the board could not be loaded when the read failed", async () => {
    respond({ ok: false });
    render(<PitchLeaderboard />);
    expect(await screen.findByText(/could not be loaded/i)).toBeTruthy();
    expect(screen.queryByText(/No pitches have counted/i)).toBeNull();
    // Said explicitly, because a manager's instinct is to read silence as "none".
    expect(screen.getByText(/Do not assume it is empty/i)).toBeTruthy();
  });

  it("offers a retry on failure", async () => {
    respond({ ok: false });
    render(<PitchLeaderboard />);
    expect(await screen.findByRole("button", { name: /Try again/i })).toBeTruthy();
  });

  it("says there are none when there genuinely are none", async () => {
    respond({ ok: true, body: { ...REP, standing: null, boardSize: 0 } });
    render(<PitchLeaderboard />);
    expect(await screen.findByText(/No pitches have counted/i)).toBeTruthy();
    expect(screen.queryByText(/could not be loaded/i)).toBeNull();
  });
});

describe("a rep sees their standing and nothing about anyone else", () => {
  it("shows the ordinal and the size of the field", async () => {
    respond({ ok: true, body: REP });
    render(<PitchLeaderboard />);
    expect(await screen.findByText("3rd")).toBeTruthy();
    expect(screen.getByText(/of 9/)).toBeTruthy();
    expect(screen.getByText(/70 points from 2 counted pitches/)).toBeTruthy();
  });

  it("renders no list of other reps at all", async () => {
    respond({ ok: true, body: REP });
    render(<PitchLeaderboard />);
    await screen.findByText("3rd");
    // The route withholds them; this asserts the component does not invent a list from `standing`
    // or fall back to rendering rows that are not there.
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("does not show the field even if rows arrive alongside managerView false", async () => {
    // Defence in depth. If the route ever regressed and leaked rows to a rep, the component must
    // still not render them — it branches on the VERDICT, never on whether rows happen to exist.
    respond({ ok: true, body: { ...REP, rows: MANAGER.rows } });
    render(<PitchLeaderboard />);
    await screen.findByText("3rd");
    expect(screen.queryByText("Ada Vance")).toBeNull();
    expect(screen.queryByText("Bo Iqbal")).toBeNull();
  });

  it("tells a rep who is ranked but not prize-eligible, before the prize is given", async () => {
    respond({ ok: true, body: REP });
    render(<PitchLeaderboard />);
    expect(
      await screen.findByText(
        new RegExp(`${PRIZE_ELIGIBLE_MIN_PITCHES} counted pitches are needed`, "i")
      )
    ).toBeTruthy();
  });

  it("says no standing is not last place", async () => {
    respond({ ok: true, body: { ...REP, standing: null } });
    render(<PitchLeaderboard />);
    expect(await screen.findByText(/not on the board for this period/i)).toBeTruthy();
    expect(screen.getByText(/not last place/i)).toBeTruthy();
  });
});

describe("a manager sees the field", () => {
  it("lists every rep with rank, name and total", async () => {
    respond({ ok: true, body: MANAGER });
    render(<PitchLeaderboard />);
    expect(await screen.findByText("Ada Vance")).toBeTruthy();
    expect(screen.getByText("Bo Iqbal")).toBeTruthy();
    expect(screen.getByText("180")).toBeTruthy();
  });

  it("shows counted against total handed in, so 3 of 4 is visible", async () => {
    respond({ ok: true, body: MANAGER });
    render(<PitchLeaderboard />);
    expect(await screen.findByText("3/4")).toBeTruthy();
  });

  it("marks a rep who is below the prize threshold", async () => {
    respond({ ok: true, body: MANAGER });
    render(<PitchLeaderboard />);
    expect(
      await screen.findByText(new RegExp(`under ${PRIZE_ELIGIBLE_MIN_PITCHES}`, "i"))
    ).toBeTruthy();
  });

  it("says so when a name could not be resolved, rather than printing a uuid", async () => {
    respond({ ok: true, body: { ...MANAGER, rows: [row({ fullName: null })] } });
    render(<PitchLeaderboard />);
    expect(await screen.findByText(/Name unavailable/i)).toBeTruthy();
    expect(screen.queryByText("r1")).toBeNull();
  });

  it("shows the manager their own standing too, because they compete as well", async () => {
    respond({ ok: true, body: MANAGER });
    render(<PitchLeaderboard />);
    expect(await screen.findByText("2nd")).toBeTruthy();
  });
});

describe("the board says what it ranks", () => {
  it("states the rule on screen", async () => {
    // A leaderboard whose rule is invisible is the thing this whole collision was about.
    respond({ ok: true, body: MANAGER });
    render(<PitchLeaderboard />);
    expect(await screen.findByText(/Total points from counted pitches/i)).toBeTruthy();
    expect(screen.getByText(/equal totals share a place/i)).toBeTruthy();
  });

  it("reports pitches too old to place rather than folding them in at zero", async () => {
    respond({ ok: true, body: { ...MANAGER, skippedPreVerdict: 4 } });
    render(<PitchLeaderboard />);
    expect(await screen.findByText(/4 older pitches are not/i)).toBeTruthy();
  });

  it("says nothing about skipped pitches when there are none", async () => {
    respond({ ok: true, body: MANAGER });
    render(<PitchLeaderboard />);
    await screen.findByText("Ada Vance");
    expect(screen.queryByText(/older pitch/i)).toBeNull();
  });
});

describe("periods", () => {
  it("opens on this week", async () => {
    respond({ ok: true, body: MANAGER });
    render(<PitchLeaderboard />);
    await screen.findByText("Ada Vance");
    expect(String(fetchMock.mock.calls[0]![0])).toContain("period=week");
  });

  it("re-reads when the period changes", async () => {
    respond({ ok: true, body: MANAGER });
    render(<PitchLeaderboard />);
    await screen.findByText("Ada Vance");
    fireEvent.click(screen.getByRole("button", { name: /All time/i }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("period=all"))).toBe(true)
    );
  });

  it("marks the selected period for assistive tech, not only by colour", async () => {
    respond({ ok: true, body: MANAGER });
    render(<PitchLeaderboard />);
    await screen.findByText("Ada Vance");
    expect(screen.getByRole("button", { name: /This week/i }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /All time/i }).getAttribute("aria-pressed")).toBe("false");
  });
});

describe("ordinals read the way a person says them", () => {
  it.each([
    [1, "1st"], [2, "2nd"], [3, "3rd"], [4, "4th"],
    [11, "11th"], [12, "12th"], [13, "13th"], [21, "21st"], [22, "22nd"], [23, "23rd"],
  ])("rank %i reads as %s", async (rank, text) => {
    // 11th, 12th and 13th are the cases a naive last-digit rule gets wrong.
    respond({ ok: true, body: { ...REP, standing: { ...REP.standing, rank }, boardSize: 30 } });
    render(<PitchLeaderboard />);
    expect(await screen.findByText(text)).toBeTruthy();
  });
});
