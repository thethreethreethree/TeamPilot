// @vitest-environment jsdom
import { describe, it, vi } from "vitest";
import { render, waitFor, within } from "@testing-library/react";

import { capture, stubBrowserApis } from "@/test/visual";

/**
 * The Macro Mode mobile home — the surface a door-to-door rep lives on.
 *
 * Captured because it is where a one-way door was found (founder 2026-09-24: "it dissapeared and
 * now i can't see the button … the system reamins in MACRO mode") and where its fix landed. The
 * header row now carries three controls on a 390px phone: "Back to ELOSTATE", an Account link, and
 * "Exit Macro Mode". Whether three fit is not something a test can answer.
 *
 * Captures live under `src/test/` rather than beside the page on purpose: a `.tsx` inside
 * `src/app/` is compiled into the Next build, and a file that imports Testing Library has no
 * business in a production bundle.
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
  it("macro mobile home", async () => {
    stubBrowserApis();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/macro-mode")) return { ok: true, json: async () => ({ enabled: true }) };
        if (url.includes("day-target"))
          return {
            ok: true,
            json: async () => ({
              localDate: "2026-09-24",
              repName: "Rep",
              target: {
                doorsTarget: 80,
                presentationsTarget: 18,
                soldTarget: 2,
                usedStarter: true,
                salesGoal: 2,
                closeRatio: null,
                contactRatio: null,
                saleValueCents: null,
              },
              today: { doors: 3, presentations: 2, sold: 1 },
            }),
          };
        if (url.includes("/door-log"))
          return { ok: true, json: async () => ({ doorsKnocked: 3, presentations: 2, sold: 1 }) };
        if (url.includes("/identity")) return { ok: true, json: async () => ({ fullName: "Rep" }) };
        return { ok: true, json: async () => ({}) };
      })
    );

    const { container } = render(<SalesCoachHome />);
    const mobile = container.querySelector('[class~="md:hidden"]') as HTMLElement;
    await waitFor(() =>
      within(mobile).getByRole("button", { name: /exit macro mode/i })
    );

    // 390px — an iPhone 14 in CSS pixels. The width is mandatory: without it the subtree lays out
    // unconstrained and a row that fits renders as clipped, which is how this tool nearly reported
    // its own first false finding.
    capture("macro-home", mobile, { width: 390, height: 844 });
  });
});
