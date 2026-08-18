// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";

/**
 * Render guard for PitchDetail (Macro Mode Report Card drill-down). Same class as the founder's original
 * "only No Answer" bug (2026-08-18): a primary control (here the back-to-Report-Card nav) was under the
 * status-bar clock and untappable, and the content lived inside a shell-clipped container. This mounts the
 * REAL component and asserts, at render level:
 *   - the back-nav ALWAYS renders (in loading, loaded, and failed states) with an href a rep can leave through,
 *   - the loaded analysis surfaces its primary content (name, scores, summary, strengths, transcript),
 *   - a failed pitch shows the HONEST failure here — not a blank, and never the Door Log (the honesty rule).
 * A node logic test can't see these; only a render can.
 */

function stubFetch(payload: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: status >= 200 && status < 300, status, json: async () => payload })),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

import { PitchDetail } from "../PitchDetail";

const ANALYZED = {
  id: "p1",
  name: "Blue door, angry homeowner",
  status: "complete",
  error: null,
  recordedAt: "2026-08-18T15:00:00Z",
  outcome: "Sold",
  transcript: "Rep: Hi there...",
  analysis: {
    summary: "Strong open, rushed the close.",
    strengths: ["Warm greeting"],
    improvements: ["Slow the close"],
    scores: { rapport: 80, clarity: 65 },
  },
};

describe("PitchDetail — render guard (founder 2026-08-18 clip class)", () => {
  it("loaded: back-nav + primary analysis content all render", async () => {
    stubFetch(ANALYZED);
    render(<PitchDetail pitchId="p1" />);

    // Back-nav is the escape hatch — it must render and point at the Report Card.
    const back = screen.getByRole("link", { name: /Pitch Performance/i });
    expect(back.getAttribute("href")).toBe("/dashboard/sales-coach/doors/report-card");

    await waitFor(() => expect(screen.getByText("Blue door, angry homeowner")).toBeTruthy());
    expect(screen.getByText("Scores")).toBeTruthy();
    expect(screen.getByText("rapport")).toBeTruthy();
    expect(screen.getByText("Summary")).toBeTruthy();
    expect(screen.getByText("Strong open, rushed the close.")).toBeTruthy();
    expect(screen.getByText("Transcript")).toBeTruthy();
  });

  it("failed pitch: the honest failure shows here (not a blank, not the Door Log)", async () => {
    stubFetch({ ...ANALYZED, status: "failed", error: "Audio was too quiet to transcribe.", analysis: null });
    render(<PitchDetail pitchId="p1" />);

    await waitFor(() => expect(screen.getByText("Processing failed")).toBeTruthy());
    expect(screen.getByText("Audio was too quiet to transcribe.")).toBeTruthy();
    // Back-nav still present so a rep is never stranded on a failed pitch.
    expect(screen.getByRole("link", { name: /Pitch Performance/i })).toBeTruthy();
  });

  it("not found (404): an honest 'isn't available', back-nav intact", async () => {
    stubFetch(null, 404);
    render(<PitchDetail pitchId="missing" />);

    await waitFor(() => expect(screen.getByText(/isn't available/i)).toBeTruthy());
    expect(screen.getByRole("link", { name: /Pitch Performance/i })).toBeTruthy();
  });
});
