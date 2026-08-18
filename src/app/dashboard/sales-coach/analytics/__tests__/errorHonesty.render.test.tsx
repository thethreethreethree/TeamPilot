// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";

/**
 * Honesty guard for the Analytics personal stats (audit 2026-08-18, founder-directed sweep). The team half of
 * this page already distinguished a failed fetch from an empty team (teamDegraded); the PERSONAL half did not —
 * a failed /dashboard fetch left stats=null and rendered Sessions 0 · Reviews 0 · Cues 0, telling a rep their
 * work vanished (error-as-no-data / INV22). This locks the fix: on a failed own-stats fetch the page shows
 * an honest "couldn't load" instead of all-zero cells, and on success it shows the real numbers.
 */

vi.mock("@/components/layout/TopBar", () => ({ default: () => null }));
vi.mock("@/components/learning/LearningHint", () => ({
  LearningHint: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/components/sales-coach/AgentEloBadge", () => ({ AgentEloBadge: () => null }));
vi.mock("@/components/sales-coach/StandardAnalyticsManagerView", () => ({
  StandardAnalyticsManagerView: () => null,
}));
vi.mock("@/components/experience/ExperienceModeProvider", () => ({
  useExperienceMode: () => ({ isStandard: false, loaded: true }),
}));

import AnalyticsPage from "../page";

function stubFetch(dashboardOk: boolean) {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() })));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/dashboard")) {
        return dashboardOk
          ? { ok: true, status: 200, json: async () => ({ stats: { sessionsTotal: 42, reviewsGenerated: 5, cuesTotal: 100, recentGrowth: [] }, series: [] }) }
          : { ok: false, status: 500, json: async () => ({}) };
      }
      if (url.includes("/team-analytics")) return { ok: true, status: 200, json: async () => ({ degraded: false, team: null, series: [] }) };
      return { ok: true, status: 200, json: async () => ({}) };
    }),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Analytics — personal stats never dress a fetch error as zeros (founder 2026-08-18)", () => {
  it("own-stats fetch fails: honest 'couldn't load', NOT Sessions 0 / Reviews 0", async () => {
    stubFetch(false);
    render(<AnalyticsPage />);
    await waitFor(() => expect(screen.getByText(/Couldn't load your analytics/i)).toBeTruthy());
    // The zero-cells must be gone — their labels are replaced by the honest banner.
    expect(screen.queryByText("Sessions")).toBeNull();
    expect(screen.queryByText("Reviews")).toBeNull();
  });

  it("own-stats fetch succeeds: the real numbers render, no error banner", async () => {
    stubFetch(true);
    render(<AnalyticsPage />);
    await waitFor(() => expect(screen.getByText("Sessions")).toBeTruthy());
    expect(screen.getByText("42")).toBeTruthy();
    expect(screen.queryByText(/Couldn't load your analytics/i)).toBeNull();
  });
});
