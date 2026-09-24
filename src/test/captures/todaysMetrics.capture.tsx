// @vitest-environment jsdom
import { describe, it, vi } from "vitest";
import { expect } from "vitest";
import { render, waitFor } from "@testing-library/react";

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
});
