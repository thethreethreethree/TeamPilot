// @vitest-environment jsdom
import { describe, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

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
  // One rep, shaped from `RepRow` at teamAssessment.ts:217 rather than invented — without this
  // the table renders its empty state and the rep-detail path, which is the demo path, is never
  // reached.
  reps: [
    {
      repId: "rep1",
      fullName: "Jordan Ellis",
      avgPitchScore: 74.2,
      band: "Solid",
      totalPoints: 891,
      doors: 118,
      presentations: 31,
      sold: 4,
      // A PERCENTAGE (12.9 = 12.9%), because readTeamAssessment.ts:196 converts before the wire.
      // Feeding the ratio here rendered "0.129%" and I nearly reported it as a 100x bug.
      closeRate: 12.9,
      lowestSection: "close",
      lowestSectionLabel: "Close",
      focus: "Ask for the sale before the second objection.",
    },
  ],
  // `RepDetail` is { aggregate: PeriodAggregate; kpis: ActivityKpis } (readTeamAssessment.ts:48),
  // keyed by rep id. Leaving it empty renders the table but never the detail panel — so the tab
  // strip, which is the point of this capture, never appears.
  detail: {
    rep1: {
      aggregate: {
        avgPitchScore: 74.2,
        avgBase: 66.1,
        avgBonus: 10.4,
        avgViolations: 2.3,
        counted: 9,
        pitchesTotal: 11,
        notCountedReasons: { base_under_40: 2 },
      },
      kpis: {
        doorsKnocked: 118,
        presentations: 31,
        sold: 4,
        doorToPresentationRate: 0.262,
        closeRate: 0.129,
      },
    },
  },
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

  /**
   * THE REP-DETAIL PATH — Coach Assessment → click a rep → the Overview / Recordings tabs.
   *
   * This is the path recommended for the investor demo (docs/DEMO-READINESS-2026-09-24.md), and
   * it is the one surface on that path never rendered: the tab strip was built on 2026-09-22 and
   * verified only by string assertions.
   */
  it("coach assessment, a rep selected", async () => {
    stubBrowserApis();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("coach-assessment/dashboard")) return { ok: true, json: async () => WIRE };
        if (url.includes("pitch-recordings"))
          return { ok: true, json: async () => ({ rows: [], capped: false, total: 0 }) };
        if (url.includes("coach-assessment")) return { ok: true, json: async () => ({ reps: [] }) };
        return { ok: true, json: async () => ({}) };
      })
    );

    const { container } = render(<CoachAssessmentBoard />);
    // findAll: the name appears in the table AND in the detail header once a rep is selected.
    const [row] = await screen.findAllByText("Jordan Ellis", undefined, { timeout: 8000 });
    if (row) fireEvent.click(row);
    await screen.findAllByText(/Recordings/i, undefined, { timeout: 8000 });

    capture("coach-assessment-rep", container.firstElementChild as HTMLElement, {
      width: 1180,
      height: 1100,
    });
  });
});
