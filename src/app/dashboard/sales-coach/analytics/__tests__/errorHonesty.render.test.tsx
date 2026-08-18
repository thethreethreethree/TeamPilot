// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";

/**
 * Honesty guard for Analytics fetch failures (audit 2026-08-18, founder-directed sweep). The team half already
 * distinguished a failed fetch from an empty team (teamDegraded); two other paths did not and are locked here:
 *   - PERSONAL stats: a failed /dashboard fetch left stats=null → Sessions 0 · Reviews 0 · Cues 0, telling a rep
 *     their work vanished (error-as-no-data / INV22). Now shows an honest "couldn't load your analytics".
 *   - Standard-mode SKILLS: the fetch swallowed errors, leaving skills=null → SkillScores spun "Reading your
 *     recent calls…" FOREVER on any failure. Now shows an honest "couldn't read your recent calls".
 */

const h = vi.hoisted(() => ({ standard: false }));

vi.mock("@/components/layout/TopBar", () => ({ default: () => null }));
vi.mock("@/components/learning/LearningHint", () => ({
  LearningHint: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/components/sales-coach/AgentEloBadge", () => ({ AgentEloBadge: () => null }));
// Render the fallback (SkillScores) directly so the Standard skills path is exercisable.
vi.mock("@/components/sales-coach/StandardAnalyticsManagerView", () => ({
  StandardAnalyticsManagerView: ({ fallback }: { fallback: React.ReactNode }) => fallback,
}));
vi.mock("@/components/experience/ExperienceModeProvider", () => ({
  useExperienceMode: () => ({ isStandard: h.standard, loaded: true }),
}));

import AnalyticsPage from "../page";

function stubFetch(opts: { dashboardOk?: boolean; skillsOk?: boolean } = {}) {
  const { dashboardOk = true, skillsOk = true } = opts;
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() })));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/skills")) {
        return skillsOk
          ? { ok: true, status: 200, json: async () => ({ skills: [], sampleSessions: 0 }) }
          : { ok: false, status: 500, json: async () => ({}) };
      }
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
  h.standard = false;
});

describe("Analytics — fetch errors never render as no-data (founder 2026-08-18)", () => {
  it("own-stats fetch fails: honest 'couldn't load', NOT Sessions 0 / Reviews 0", async () => {
    stubFetch({ dashboardOk: false });
    render(<AnalyticsPage />);
    await waitFor(() => expect(screen.getByText(/Couldn't load your analytics/i)).toBeTruthy());
    expect(screen.queryByText("Sessions")).toBeNull();
    expect(screen.queryByText("Reviews")).toBeNull();
  });

  it("own-stats fetch succeeds: the real numbers render, no error banner", async () => {
    stubFetch({ dashboardOk: true });
    render(<AnalyticsPage />);
    await waitFor(() => expect(screen.getByText("Sessions")).toBeTruthy());
    expect(screen.getByText("42")).toBeTruthy();
    expect(screen.queryByText(/Couldn't load your analytics/i)).toBeNull();
  });

  it("Standard skills fetch fails: honest 'couldn't read', NOT an infinite 'Reading your recent calls…'", async () => {
    h.standard = true;
    stubFetch({ skillsOk: false });
    render(<AnalyticsPage />);
    await waitFor(() => expect(screen.getByText(/Couldn't read your recent calls/i)).toBeTruthy());
    expect(screen.queryByText(/Reading your recent calls/i)).toBeNull();
  });
});
