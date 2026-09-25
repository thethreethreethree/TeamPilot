// @vitest-environment jsdom
import { describe, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { capture, stubBrowserApis } from "@/test/visual";

/**
 * Sales Coach → KPI Analytics, as a MANAGER sees it.
 *
 * The page imports no local components, so its render tree IS its file: 7 white-alpha sites on 5 lines
 * (:488 growth summary, :568 the four layer cards — border AND fill, :648 the Team card — border AND
 * fill, :704 the quota row, :797 the team list dividers). Four of the five only render in the manager
 * view, so the fixture must make `/api/coach/kpi/team` succeed — a rep-view capture would photograph two
 * of seven and report the route done.
 *
 * Shapes are the page's own: `KpiResponse` and `TeamAgent` at kpi/page.tsx:19-44.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/dashboard/sales-coach/kpi",
}));

import KpiAnalyticsPage from "@/app/dashboard/sales-coach/kpi/page";

/** Percent metrics arrive as PERCENT (compute.ts:63 multiplies by 100), not as fractions. */
const m = (value: number | null, sampleSize = 24) => ({
  value,
  sampleSize,
  gated: value === null,
  sourceSessionIds: [],
});

/** `KpiResponse` — kpi/page.tsx:21-27. Company scope, past the Understanding Gate (24 >= 5). */
const ME = {
  sessionCount: 24,
  minSessions: 5,
  metrics: {
    conversionRate: m(21),
    closeRate: m(38),
    winLossRatio: m(0.61),
    avgDealSize: m(89),
    revenue: m(1780),
    salesCycleLength: m(null, 0),
    quotaAttainment: m(55),
    sessionsPerDay: m(6.4),
    avgSessionDurationMin: m(4.2),
    l2_talk_ratio: m(58),
    objectionsPerSession: m(1.8),
    objectionResolutionRate: m(46),
    followUpRate: m(null, 0),
    l3_question_rate: m(62),
    l3_tone: m(71),
    l3_objection: m(48),
    l3_opener: m(66),
    l3_close: m(39),
    l3_next_step: m(52),
    relianceReduction: m(-0.12),
    cueAcceptanceRate: m(34),
    cueToOutcome: m(0.18),
    skillProgression: m(4),
    recommendationUptake: m(40),
    consistency: m(63),
  },
  // Two up, one down — so the growth summary at :488 renders BOTH its halves.
  deltas: { conversionRate: 3, closeRate: -2, sessionsPerDay: 0.8 },
  sessions: {},
};

/** `TeamAgent` — kpi/page.tsx:29-44. */
const agent = (id: string, name: string, conv: number, sessions: number, extra: Record<string, unknown> = {}) => ({
  agentId: id,
  name,
  companyRole: "Member",
  sessionCount: sessions,
  firstSessionAt: "2026-07-02T15:00:00.000Z",
  establishingBaseline: false,
  conversionRate: m(conv, sessions),
  relianceReduction: m(-0.08, sessions),
  quotaAttainment: m(50, sessions),
  objectionsPerSession: m(1.6, sessions),
  objectionResolutionRate: m(50, sessions),
  recommendationUptake: m(40, sessions),
  followUpRate: m(null, 0),
  salesCycleLength: m(null, 0),
  slipping: false,
  ...extra,
});

const TEAM = {
  alertDropPct: 20,
  monthlyQuotaTarget: 12,
  agents: [
    agent("a1", "Jordan Ellis", 27, 41),
    agent("a2", "Sam Ortiz", 19, 33, { slipping: true, slippingReasons: ["Conversion down 24% vs his baseline"] }),
    agent("a3", "Priya Raman", 22, 18),
    agent("a4", "Devon Blake", 0.0, 3, { establishingBaseline: true }),
  ],
};

describe("capture", () => {
  it("kpi, a manager's company view", async () => {
    stubBrowserApis();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/coach/kpi/team")) return { ok: true, status: 200, json: async () => TEAM };
        if (url.includes("/api/coach/kpi/me")) return { ok: true, status: 200, json: async () => ME };
        return { ok: true, status: 200, json: async () => ({}) };
      })
    );
    const { container } = render(<KpiAnalyticsPage />);
    // The growth summary's COMPANY wording (:494) — it exists only once the team has loaded (which flips
    // scope to company) AND the deltas moved. Chrome, the rep view, and a failed team fetch all lack it.
    await screen.findByText(/Vs the company.s earlier calls, up in/i, undefined, { timeout: 8000 });
    // A Team-card row, so the capture is not taken between the summary and the roster.
    await screen.findByText(/Priya Raman/i, undefined, { timeout: 8000 });
    capture("kpi", container, { width: 1180, height: 2600 });
  });
});
