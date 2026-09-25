// @vitest-environment jsdom
import { describe, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { capture, stubBrowserApis } from "@/test/visual";

/**
 * PitchDetail — the Report Card drill-down for one door pitch. Never photographed before 2026-09-25.
 *
 * Its score TRACK (:135) was a `bg-white/10` bar — invisible on cream — and was fixed by pattern with
 * TodaysMetrics' identical one. This photographs it rather than leaving it "fixed, unseen".
 *
 * `Detail` is the component's own type (PitchDetail.tsx:12-26). Scores are 0-100, the scale the grader
 * is held to (doorlog/analyze.ts:34) — two fixtures today were written on a 0-10 scale and drew
 * bars that looked like a product bug.
 */

import { PitchDetail } from "@/components/sales-coach/doorlog/PitchDetail";

const DETAIL = {
  id: "p1",
  name: "Maple St · #412",
  status: "analyzed",
  error: null,
  recordedAt: "2026-09-24T17:42:00.000Z",
  outcome: "presented",
  transcript: "Rep: Morning — I'm with the fiber crew on Maple this week.\nProspect: We're with Spectrum.",
  analysis: {
    summary: "Strong opener and a clean reason for the visit; the close never arrived.",
    strengths: ["Named the crew on the street in the first line"],
    improvements: ["Ask for the appointment before the prospect steps back inside"],
    scores: { objection: 52, talk_listen: 68, questions: 79, tone: 81, close: 46 },
  },
};

describe("capture", () => {
  it("pitch detail, an analysed pitch", async () => {
    stubBrowserApis();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => DETAIL })));
    const { container } = render(<PitchDetail pitchId="p1" />);
    // The fixture's own summary — present only once the detail has loaded.
    await screen.findByText(/the close never arrived/i, undefined, { timeout: 8000 });
    capture("pitch-detail", container, { width: 390, height: 1300 });
  });
});
