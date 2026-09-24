// @vitest-environment jsdom
import { describe, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { capture, stubBrowserApis } from "@/test/visual";
import { CoachAssessmentBoard } from "@/components/sales-coach/CoachAssessmentBoard";

/**
 * Coach Assessment — the manager dashboard a partner asked about by name:
 * "can we get the manager dashboard to start showing recordings?"
 *
 * It is the densest surface in the module — team score cards, a KPI row, section bars, priority
 * cards, a reps table — and it has never been rendered on a light ground.
 *
 * The wire shape below is copied from the `Wire` type at CoachAssessmentBoard.tsx:43, field by
 * field. Inventing it from the component's JSX is how a capture ends up photographing an error
 * state and calling it the screen.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/dashboard/sales-coach/coach-assessment",
}));

const WIRE = {
  period: "week" as const,
  team: {
    aggregate: {
      avgPitchScore: 68.4,
      avgBase: 61.2,
      avgBonus: 9.8,
      avgViolations: 2.6,
      counted: 34,
      pitchesTotal: 41,
      notCountedReasons: { base_under_40: 5, no_discovery: 2 },
    },
    kpis: {
      doorsKnocked: 612,
      presentations: 143,
      sold: 18,
      doorToPresentationRate: 0.234,
      closeRate: 0.126,
    },
    totalPoints: 2326,
    counted: 34,
    pitchesTotal: 41,
    prizeEligible: 4,
    repCount: 7,
    minPitchesForPrize: 5,
  },
  bars: [],
  priorities: [],
  reps: [],
  detail: {},
  capped: false,
  unattributed: 0,
  briefGeneratedAt: "2026-09-24T06:00:00.000Z",
  reviewFlags: [],
  reviewFlagsTotal: 0,
};

describe("capture", () => {
  it("coach assessment board", async () => {
    stubBrowserApis();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("coach-assessment/dashboard"))
          return { ok: true, json: async () => WIRE };
        if (url.includes("coach-assessment")) return { ok: true, json: async () => ({ reps: [] }) };
        return { ok: true, json: async () => ({}) };
      })
    );

    const { container } = render(<CoachAssessmentBoard />);
    // findAll: the board legitimately shows the team average in more than one place.
    await screen.findAllByText(/68\.4/, undefined, { timeout: 8000 });

    capture("coach-assessment", container.firstElementChild as HTMLElement, {
      width: 1180,
      height: 900,
    });
  });
});
