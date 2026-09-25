// @vitest-environment jsdom
import { describe, it, vi } from "vitest";
import { expect } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { capture, stubBrowserApis } from "@/test/visual";

/**
 * Today's Metrics — a Macro rep's daily screen, and another swipeable pager.
 *
 * Two reasons to capture it. It is one of the four tabs in the Macro bottom nav, so a door-to-door
 * rep opens it constantly; and it is a PAGER, which is the component shape that produced the
 * one-way door and whose inactive dot was invisible on cream until a few hours ago. This confirms
 * the dot fix on a second pager rather than assuming it generalises from the one that was
 * screenshotted.
 *
 * Its children (RepArena, PitchMilestones, PitchBreakdown, TodaysMetrics) each fetch; they are
 * left to their own empty/error states rather than stubbed into a pretty lie. An empty state IS a
 * state a rep sees — on this product more than most, since nothing scores a pitch automatically
 * until today's pipeline runs.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/dashboard/sales-coach/doors/todays-metrics",
}));

import { TodaysMetricsPager } from "@/components/sales-coach/TodaysMetricsPager";
import { TodaysMetrics } from "@/components/sales-coach/doorlog/TodaysMetrics";

describe("capture", () => {
  it("todays metrics, progress page", async () => {
    stubBrowserApis();
    // The REP shape from /leaderboard — `{ period, managerView, meId }` with NO rows, at 200.
    // This is the body that crashed RepArena until 2026-09-24, so the capture drives the real
    // thing rather than a convenient full-manager fixture.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("leaderboard"))
          return { ok: true, json: async () => ({ period: "all", managerView: false, meId: "me" }) };
        if (url.includes("my-points"))
          return {
            ok: true,
            json: async () => ({
              rows: [{ session_id: "s1", points: 74, band: "solid", created_at: "2026-09-20T00:00:00Z" }],
              total: 74,
              avg: 74,
              sessions: 1,
            }),
          };
        if (url.includes("milestones"))
          return {
            ok: true,
            json: async () => ({
              milestones: {
                firstPitch: "2026-09-20T00:00:00.000Z",
                fiveCounted: null,
                tenCounted: null,
                firstStrong: null,
                firstElite: null,
                cleanWeek: null,
              },
              capped: false,
            }),
          };
        /*
         * The breakdown board. `PitchBreakdown.tsx:95` takes `body.aggregate` on trust and reads
         * `agg.counted` unguarded, so a body without it throws THROUGH the render. Its two
         * neighbours on the same line are defended (`skippedPreVerdict ?? 0`, `capped === true`)
         * with a comment about old servers — the one field that can throw is the one field taken
         * on trust. The route always sends it, so this is a fixture obligation, not a live bug;
         * it is recorded in the residual as an unguarded wire cast rather than fixed here.
         */
        /*
         * The KPI trio. This capture is NAMED for this component and never served its route — the
         * catch-all did, so `data` became `{}` and the photograph was of the pre-fetch zero state
         * rather than of the surface. `TodaysMetrics.tsx:179` then reads `data?.kpi.doorsKnocked`:
         * the `?.` stops at `data` and `.kpi` is bare, so `{}` throws after the capture is taken —
         * which is why this went unnoticed. `scores` two lines up IS double-guarded (`?.scores?.`).
         * Recorded in the residual; the route always sends `kpi`, so it is latent, not live.
         */
        if (url.includes("todays-metrics"))
          return {
            ok: true,
            json: async () => ({
              period: "day",
              range: null,
              kpi: { doorsKnocked: 64, conversations: 19, sold: 3 },
              scores: { opener: 74, discovery: 61, objection: 52, talk_listen: 68, questions: 79, tone: 81, close: 46 }, // 0-100 (analyze.ts:34)
              focus: "Ask for the sale before you leave the porch.",
              opportunities: [
                "Three doors reached Discovery and stopped there.",
                "Two objections were answered without naming the concern underneath.",
              ],
            }),
          };

        if (url.includes("pitch-score/breakdown"))
          return {
            ok: true,
            json: async () => ({
              aggregate: {
                pitchesTotal: 0,
                counted: 0,
                notCounted: 0,
                notCountedReasons: {},
                totalPoints: 0,
                avgPitchScore: 0,
                avgBase: 0,
                avgBonus: 0,
                avgViolations: 0,
                bestPitchScore: null,
                sectionAverages: {},
                elementStats: [],
                bonusStats: [],
                violationStats: [],
              },
              skippedPreVerdict: 0,
              capped: false,
            }),
          };

        /*
         * AND THEN I DID IT AGAIN. The paragraph below was written this morning, and the
         * catch-all it describes is the line it sits above — which is what served the breakdown
         * route the `{}` that crashed it. A note explaining a trap, directly above the trap.
         *
         * A catch-all returning `{}` CRASHED PitchMilestones on `data.milestones[key]`, and it is
         * NOT a product bug — that route has exactly one 200 shape and the component guards
         * `res.ok`, so `{}` is a body it can never receive. My stub invented it.
         *
         * Recorded here because the distinction is the whole sweep: RepArena's leaderboard route
         * genuinely returns TWO success shapes, one of them reduced, which is why its cast was
         * live. A capture that feeds every endpoint `{}` manufactures crashes that cannot happen,
         * and reporting one of those as a defect is worse than finding nothing.
         */
        return { ok: true, json: async () => ({}) };
      })
    );

    const { container } = render(<TodaysMetricsPager />);
    // Wait for the pager's own chrome — the swipe hint is the last thing it paints — rather than
    // for a string inside a child. Guessing at a child's text is how a capture waits for something
    // that never arrives and reports a timeout instead of a screen.
    await waitFor(() => expect(container.querySelectorAll("button").length).toBeGreaterThan(0), {
      timeout: 8000,
    });
    // Let the children's fetches settle so this is the loaded screen, not the skeleton.
    await new Promise((r) => setTimeout(r, 400));

    // `container`, not `firstElementChild`: this pager paints into a wrapper whose first child is
    // not the surface. The harness REFUSED to photograph the null — which is the guard working, and
    // is why it is a throw rather than a silent empty PNG.
    capture("todays-metrics", container, {
      width: 390,
      height: 844,
    });
  });

  /**
   * THE METRICS PAGE ITSELF (2026-09-25). The test above photographs the pager's default page only —
   * its wait names no Metrics-page string — so TodaysMetrics' tiles, score tracks and date inputs had
   * never been rendered. Rendered directly here, with the same fixture, then switched to Custom so the
   * two date inputs (:114, :123) are in frame too.
   */
  it("todays metrics, the metrics page with a custom range", async () => {
    stubBrowserApis();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          period: "day",
          range: null,
          kpi: { doorsKnocked: 64, conversations: 19, sold: 3 },
          scores: { opener: 74, discovery: 61, objection: 52, talk_listen: 68, questions: 79, tone: 81, close: 46 }, // 0-100 (analyze.ts:34)
          focus: "Ask for the sale before you leave the porch.",
          opportunities: ["Three doors reached Discovery and stopped there."],
        }),
      }))
    );
    const { container } = render(<TodaysMetrics />);
    // The fixture's focus line: present only once data has loaded, never in the skeleton or chrome.
    await screen.findByText(/Ask for the sale before you leave the porch/i, undefined, { timeout: 8000 });
    // The LOADED Day state first: tiles (:250) and score tracks (:202) render only while data is shown,
    // and switching to Custom clears it — one photo per state, or the tiles go unseen.
    capture("todays-metrics-page-day", container, { width: 390, height: 1100 });
    fireEvent.click(screen.getByRole("button", { name: /^Custom$/ }));
    await waitFor(() => expect(container.querySelectorAll('input[type="date"]').length).toBe(2), { timeout: 4000 });
    capture("todays-metrics-page", container, { width: 390, height: 1100 });
  });
});
