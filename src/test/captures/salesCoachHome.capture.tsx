// @vitest-environment jsdom
import { describe, it, vi } from "vitest";
import { render, waitFor, within } from "@testing-library/react";

import { capture, stubBrowserApis } from "@/test/visual";

/**
 * The NORMAL (non-Macro) Sales Coach mobile home — the 2×2 launchpad.
 *
 * Captured to test a suspicion, not to admire it. The cards are built from `border-white/10` and
 * `bg-white/[0.02]`, and that pair sits on `bg-base`, which FOLLOWS the theme. White at 2% over a
 * cream field is nothing; white at 10% as a border is nothing. If the suspicion holds, this
 * screen's entire card structure dissolves in light mode.
 *
 * The suspicion came from the sibling capture, where the pager's inactive dot (`bg-white/20`)
 * vanished on cream. `white/N` is a dark-mode idiom, and this module was dark-only until a
 * ThemeToggle reached its header on 2026-09-24 — so nothing here has ever been looked at on a
 * light ground.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("@/components/experience/ExperienceModeProvider", () => ({
  useExperienceMode: () => ({ isStandard: true, loaded: true }),
}));
vi.mock("@/components/layout/TopBar", () => ({ default: () => null }));
vi.mock("@/components/learning/LearningHint", () => ({ LearningHint: () => null }));

import SalesCoachHome from "@/app/dashboard/sales-coach/page";

describe("capture", () => {
  it("sales coach mobile home, macro off", async () => {
    stubBrowserApis();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/macro-mode")) return { ok: true, json: async () => ({ enabled: false }) };
        if (url.includes("/identity")) return { ok: true, json: async () => ({ fullName: "Rep" }) };
        if (url.includes("/dashboard"))
          return {
            ok: true,
            json: async () => ({
              stats: {
                sessionsTotal: 66,
                sessionsThisWeek: 4,
                activeCount: 0,
                awaitingReview: 0,
                reviewedCount: 0,
                cuesTotal: 0,
                reviewsGenerated: 0,
                recentGrowth: [],
              },
            }),
          };
        return { ok: true, json: async () => ({}) };
      })
    );

    const { container } = render(<SalesCoachHome />);
    const mobile = container.querySelector('[class~="md:hidden"]') as HTMLElement;
    await waitFor(() => within(mobile).getByText("Live AI Coach & Sessions"));

    capture("sales-coach-home", mobile, { width: 390, height: 844 });
  });
});
