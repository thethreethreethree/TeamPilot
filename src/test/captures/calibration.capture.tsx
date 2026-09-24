// @vitest-environment jsdom
import { describe, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { capture, stubBrowserApis } from "@/test/visual";

/**
 * Calibration — a manager hand-scores a transcript blind and compares to the AI, to confirm the
 * score is trustworthy BEFORE it drives the leaderboard.
 *
 * Rendered because of a debt rather than a suspicion: the previous build changed this screen's
 * "Submit & compare" button from `bg-primary text-white` (a background that emitted nothing, so
 * white text sat on the page background) to ember, and did it from source without ever seeing the
 * screen. "Fixed by pattern" is a weaker claim than "fixed and seen"; this closes the gap.
 *
 * Two states, because they are two different screens: the SCORING form, and the REPORT that
 * appears once enough sessions have been scored to say anything.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/dashboard/sales-coach/calibration",
}));
vi.mock("@/components/layout/TopBar", () => ({ default: () => null }));

import CalibrationPage from "@/app/dashboard/sales-coach/calibration/page";

/** `Data` at CalibrationTool.tsx:29. */
const TRANSCRIPT = `Rep: Morning — I'm with the fiber crew that's been on Maple this week.
Customer: I've already got internet and I'm late for something.
Rep: Totally fair. Who are you with right now?
Customer: Spectrum. It's fine. Why?
Rep: Just checking who everyone's with around here.
Customer: Alright, well — thanks.
Rep: Yeah, no worries. Have a good one.`;

const WITH_WORK = {
  report: { n: 3, perDimension: [], worstDisagreements: [], overallTrustworthy: null },
  scored: 3,
  pool: 12,
  next: { sessionId: "s1", transcript: TRANSCRIPT },
};

/**
 * The report state. `trustworthy` is deliberately MIXED — two dimensions agree with the model and
 * one does not — because a report where every row says the same thing photographs one styling
 * branch and leaves the other unseen. The same reason the Scoreboard fixture put one rep in each
 * band.
 */
const WITH_REPORT = {
  report: {
    n: 24,
    perDimension: [
      { dimension: "opener", n: 24, meanAbsDiff: 0.7, trustworthy: true },
      { dimension: "objection", n: 24, meanAbsDiff: 1.1, trustworthy: true },
      { dimension: "tone", n: 24, meanAbsDiff: 2.4, trustworthy: false },
      { dimension: "close", n: 24, meanAbsDiff: 0.9, trustworthy: true },
      { dimension: "next_step", n: 24, meanAbsDiff: 1.8, trustworthy: false },
    ],
    worstDisagreements: [
      { sessionId: "s7", dimension: "tone", human: 8, model: 3, diff: 5 },
      { sessionId: "s2", dimension: "next_step", human: 2, model: 6, diff: 4 },
    ],
    overallTrustworthy: false,
  },
  scored: 24,
  pool: 24,
  next: null,
};

const serve = (body: unknown) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("calibration")) return { ok: true, json: async () => body };
      return { ok: true, json: async () => ({}) };
    })
  );

describe("capture", () => {
  it("calibration, scoring a transcript", async () => {
    stubBrowserApis();
    serve(WITH_WORK);
    const { container } = render(<CalibrationPage />);
    // The BUTTON this capture exists for, not a heading.
    await screen.findByText(/Submit & compare/i, undefined, { timeout: 8000 });
    capture("calibration", container, { width: 1180, height: 1100 });
  });

  it("calibration, the trust report", async () => {
    stubBrowserApis();
    serve(WITH_REPORT);
    const { container } = render(<CalibrationPage />);
    await screen.findAllByText(/Tone/i, undefined, { timeout: 8000 });
    capture("calibration-report", container, { width: 1180, height: 900 });
  });
});
