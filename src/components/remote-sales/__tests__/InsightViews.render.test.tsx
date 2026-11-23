// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { RemoteCalendar } from "../RemoteCalendar";
import { MarketView } from "../MarketView";
import { AdoptionBoard } from "../../sales-coach/AdoptionBoard";

/**
 * Read-only views built 2026-11-23. On screen they can mislead by showing a failed load as an empty week / market /
 * board, by hiding how to act on an entry, or by implying a win rate the data can't support.
 */
const json = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("RemoteCalendar", () => {
  const day = (d: string, booked = [] as unknown[], held = [] as unknown[]) => ({ day: d, booked, held });
  it("shows booked and held calls; a booked call opens its prospect", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json({ days: [
      day("2026-11-23", [{ prospectId: "p1", repId: "r", name: "Acme", organization: null }]),
      day("2026-11-24", [], [{ sessionId: "s1", repId: "r", startedAt: "2026-11-24T15:00:00Z", label: null, outcome: "sold", prospectId: "p2", prospectName: "Beta" }]),
      ...["25", "26", "27", "28", "29"].map((n) => day(`2026-11-${n}`)),
    ] })));
    const open = vi.fn();
    render(<RemoteCalendar scope="mine" nameOf={() => null} onOpenProspect={open} />);
    fireEvent.click(await screen.findByRole("button", { name: /Acme/ }));
    expect(open).toHaveBeenCalledWith("p1");
    expect(screen.getByRole("link", { name: /Beta/ }).getAttribute("href")).toBe("/dashboard/remote-sales/calls/s1");
  });
  it("a failed load says so, never an empty week", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json({ error: "x" }, 500)));
    render(<RemoteCalendar scope="mine" nameOf={() => null} onOpenProspect={() => {}} />);
    expect(await screen.findByText(/Couldn.t load the calendar/)).toBeTruthy();
    expect(screen.queryByText(/No calls booked or held/)).toBeNull();
  });
});

describe("MarketView", () => {
  it("a competitor with too few closed calls shows '—', not a rate", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json({
      calls: 10, withIntel: 9, closed: 6, winRate: 0.5,
      competitors: [{ name: "Acme", calls: 3, share: 0.33, closed: 2, winRate: null, weeks: [{ weekStart: "2026-11-16", calls: 3 }] }],
      topics: [{ name: "Price", calls: 7 }],
    })));
    render(<MarketView module="remote_sales" />);
    expect(await screen.findByText("Acme")).toBeTruthy();
    const row = screen.getByText("Acme").closest("tr")!;
    expect(row.textContent).toContain("—");
    expect(screen.getByText(/Price/)).toBeTruthy();
  });
  it("a failed load says so", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json({ error: "x" }, 500)));
    render(<MarketView module="remote_sales" />);
    expect(await screen.findByText(/Couldn.t build the market view/)).toBeTruthy();
  });
});

describe("AdoptionBoard", () => {
  it("each message with its share, goal and status; choosing one opens it", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json({ rows: [
      { id: "t1", name: "Bundle", calls: 10, said: 7, rate: 0.7, goal: { direction: "at_least", targetPct: 60 }, goalStatus: "met" },
      { id: "t2", name: "Old line", calls: 10, said: 3, rate: 0.3, goal: { direction: "at_most", targetPct: 5 }, goalStatus: "not_met" },
    ] })));
    const open = vi.fn();
    render(<AdoptionBoard onOpen={open} />);
    expect(await screen.findByText("On target")).toBeTruthy();
    expect(screen.getByText("Not there yet")).toBeTruthy();
    expect(screen.getByText("≤ 5%")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Old line" }));
    expect(open).toHaveBeenCalledWith("t2");
  });
});
