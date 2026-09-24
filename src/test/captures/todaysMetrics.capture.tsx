// @vitest-environment jsdom
import { describe, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

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
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({}) })));

    const { container } = render(<TodaysMetricsPager />);
    await screen.findByRole("button", { name: /progress/i }, { timeout: 8000 });

    capture("todays-metrics", container.firstElementChild as HTMLElement, {
      width: 390,
      height: 844,
    });
  });
});
