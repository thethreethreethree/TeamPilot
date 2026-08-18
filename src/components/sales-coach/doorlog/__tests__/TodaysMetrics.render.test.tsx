// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";

/**
 * Render guard for Today's Metrics (Macro Mode, founder spec 2026-08-19). Locks: the Next-Door focus, the KPI
 * trio, and the Score Chart render on a good load; only the score dims PRESENT in the data show (no phantom 0 for
 * a dim an older pitch didn't score); and a fetch failure shows an honest error, never a zeroed page.
 */

function stubFetch(payload: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok, status: ok ? 200 : 500, json: async () => payload })),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

import { TodaysMetrics } from "../TodaysMetrics";

describe("TodaysMetrics", () => {
  it("loaded: focus + KPI trio + Score Chart render; only present dims show", async () => {
    stubFetch({
      period: "day",
      kpi: { doorsKnocked: 12, conversations: 8, sold: 2 },
      // objection/tone/close present; talk_listen/questions absent (older pitches) → must NOT render.
      scores: { objection: 80, tone: 65, close: 70 },
      focus: "Slow down your close — you're rushing the ask",
      opportunities: ["Slow down your close — you're rushing the ask", "Ask one more question before pitching"],
    });
    render(<TodaysMetrics />);

    // Focus text also appears in the opportunities list (focus = opportunities[0] by design), so it renders twice.
    await waitFor(() => expect(screen.getByText("Next Door focus")).toBeTruthy());
    expect(screen.getAllByText(/Slow down your close/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Doors Knocked")).toBeTruthy();
    expect(screen.getByText("Conversations")).toBeTruthy();
    expect(screen.getByText("Sales")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    // Score Chart: present dims render...
    expect(screen.getByText("Objection")).toBeTruthy();
    expect(screen.getByText("Close")).toBeTruthy();
    // ...absent dims must NOT (no phantom zero for an unscored dimension).
    expect(screen.queryByText("Talk / Listen")).toBeNull();
    expect(screen.queryByText("Questions")).toBeNull();
    expect(screen.getByText("Opportunities to grow")).toBeTruthy();
  });

  it("fetch failure: an honest error + retry, never a zeroed page", async () => {
    stubFetch(null, false);
    render(<TodaysMetrics />);
    await waitFor(() => expect(screen.getByText(/this is an error, not an empty day/i)).toBeTruthy());
    expect(screen.getByText("Retry")).toBeTruthy();
    // The KPI labels must NOT render as zeros over an error.
    expect(screen.queryByText("Doors Knocked")).toBeNull();
  });
});
