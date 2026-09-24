// @vitest-environment jsdom
import { describe, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { capture, stubBrowserApis } from "@/test/visual";

/**
 * Pitch Performance — the report card, and one of the four tabs in the Macro mobile nav.
 *
 * A door-to-door rep reaches it constantly, and it has never been rendered on a light ground. It
 * also sits at the end of the chain this session has been repairing: a pitch is recorded, scored
 * on session close, and its result shows up here.
 *
 * THE OUTCOMES BELOW ARE `knock_outcome` VALUES (0215), not pitch-score ones. The route reads
 * `door_knocks!inner(outcome)` (report-card/route.ts:32), and `OUTCOME_BADGE` covers all five.
 *
 * My first fixture used `follow_up` and `no_sale` — `pitch_scores.outcome` values — and the screen
 * rendered them raw, underscores and all, next to a properly-styled "Sold" pill. It looked exactly
 * like an incomplete label map on a screen a rep opens daily. It was the wrong vocabulary.
 *
 * FOURTH time this session a fixture used the wrong enum for a field called `outcome`. The schema
 * has FIVE: knock_outcome (0215), sales sessions (0077), pitch_scores (0252), KPI (0205) and the
 * care learning engine (0036) — and three of them contain the token "sold". Nothing at a call site
 * says which one is in hand.
 *
 * Three states, because the interesting ones are not the happy path. `Pitch` is at
 * PitchPerformance.tsx:22 and the component tracks `loading` / `error` separately — which is the
 * distinction this codebase cares most about, since an error rendered as "no pitches yet" tells a
 * rep they have not been working.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));

import { PitchPerformance } from "@/components/sales-coach/doorlog/PitchPerformance";

const PITCHES = [
  {
    id: "p1",
    name: "Maple Ct",
    status: "complete",
    recordedAt: "2026-09-23T18:14:00.000Z",
    outcome: "sold",
    summary: "Opened with the trucks line and asked for the sale before the second objection.",
  },
  {
    id: "p2",
    name: "Alder Row",
    status: "complete",
    recordedAt: "2026-09-23T16:02:00.000Z",
    outcome: "go_back",
    summary: "Strong discovery, no close attempt.",
  },
  {
    id: "p3",
    name: "Birch Lane",
    status: "analyzing",
    recordedAt: "2026-09-23T15:40:00.000Z",
    outcome: "not_interested",
    summary: null,
  },
];

const serve = (body: unknown, ok = true) =>
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok, json: async () => body })));

describe("capture", () => {
  it("pitch performance, three recordings", async () => {
    stubBrowserApis();
    serve({ pitches: PITCHES });
    const { container } = render(<PitchPerformance />);
    await screen.findByText("Maple Ct", undefined, { timeout: 8000 });
    capture("pitch-performance", container, { width: 390, height: 844 });
  });

  it("pitch performance, nothing recorded yet", async () => {
    stubBrowserApis();
    serve({ pitches: [] });
    const { container } = render(<PitchPerformance />);
    // An empty state is a state a rep sees on day one, and on this product it is the state
    // EVERY rep is in until something scores a pitch.
    await screen.findByText(/no|yet|nothing/i, undefined, { timeout: 8000 });
    capture("pitch-performance-empty", container, { width: 390, height: 500 });
  });

  it("pitch performance, the read failed", async () => {
    stubBrowserApis();
    serve({}, false);
    const { container } = render(<PitchPerformance />);
    // The distinction that matters: a FAILED read must not render as "no pitches yet". One sends
    // a rep to reload; the other tells them they have not been working.
    await screen.findByText(/couldn|could not|failed|try again/i, undefined, { timeout: 8000 });
    capture("pitch-performance-failed", container, { width: 390, height: 500 });
  });
});
