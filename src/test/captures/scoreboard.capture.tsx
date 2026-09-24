// @vitest-environment jsdom
import { describe, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { capture, stubBrowserApis } from "@/test/visual";

/**
 * Scoreboard — TWO boards on one route, which the page's own docstring explains is the resolution
 * of a collision rather than a layout choice: Pitch Score ranks quality, Activity Points ranks
 * sessions and deals, and a rep can lead one and not the other.
 *
 * Rendered because two of its parts are known members of today's class, and one of them is the
 * exact shape found on Analytics this morning. `Scoreboard.tsx:60-66` maps five bands to chip
 * classes; FOUR are already contrast-aware (`text-emerald-700 dark:text-emerald-300` and so on)
 * and the middle one — `solid` — is `bg-white/10 text-secondary`. The correct pattern is one line
 * away in the same literal.
 *
 * `MyProgress` (mounted by Scoreboard) draws its 0 and 100 gridlines with `stroke-white/10`.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/dashboard/sales-coach/scoreboard",
}));
vi.mock("@/components/layout/TopBar", () => ({ default: () => null }));

import ScoreboardPage from "@/app/dashboard/sales-coach/scoreboard/page";

/** `LeaderboardRow & { fullName }` — leaderboard.ts:38-56. */
const PITCH_ROWS = [
  { repId: "m1", fullName: "Jordan Ellis", total_points: 891, counted: 12, pitchesTotal: 18, avgPitchScore: 74.2, bestPitchScore: 88, prizeEligible: true, rank: 1 },
  { repId: "m2", fullName: "Sam Ortiz", total_points: 604, counted: 9, pitchesTotal: 14, avgPitchScore: 67.1, bestPitchScore: 79, prizeEligible: true, rank: 2 },
  { repId: "m3", fullName: "Alex Two-Rivers", total_points: 318, counted: 5, pitchesTotal: 11, avgPitchScore: 63.6, bestPitchScore: 71, prizeEligible: true, rank: 3 },
];

/**
 * `Row` — Scoreboard.tsx:18-26. The averages are chosen to land ONE ROW IN EACH BAND, because the
 * band chip is what this capture exists to look at and a fixture that only produces two bands
 * would photograph a defect that is present and leave two others unseen.
 *
 * Bands by avg_points: elite / strong / solid / developing / needs_coaching.
 */
const POINT_ROWS = [
  { agent_id: "m1", full_name: "Jordan Ellis", sessions: 41, total_points: 3721, avg_points: 91, best_points: 118, deals: 7 },
  { agent_id: "m2", full_name: "Sam Ortiz", sessions: 28, total_points: 2184, avg_points: 78, best_points: 96, deals: 4 },
  { agent_id: "m3", full_name: "Alex Two-Rivers", sessions: 19, total_points: 1216, avg_points: 64, best_points: 81, deals: 2 },
  { agent_id: "m4", full_name: "Priya Raman", sessions: 11, total_points: 517, avg_points: 47, best_points: 63, deals: 1 },
  { agent_id: "m5", full_name: null, sessions: 4, total_points: 104, avg_points: 26, best_points: 38, deals: 0 },
];

const serve = () =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      // Two DIFFERENT leaderboard routes on one page, and their shapes are not the same. A
      // catch-all, or a single `leaderboard` match, would feed one of them the other's body.
      if (url.includes("pitch-score/leaderboard"))
        return {
          ok: true,
          json: async () => ({
            period: "all",
            managerView: true,
            rows: PITCH_ROWS,
            meId: "m1",
            standing: { repId: "m1", total_points: 891, counted: 12, pitchesTotal: 18, avgPitchScore: 74.2, bestPitchScore: 88, prizeEligible: true, rank: 1 },
            gaps: { behind: null, ahead: 287 },
            boardSize: 3,
            skippedPreVerdict: 0,
            capped: false,
          }),
        };
      if (url.includes("gamification/leaderboard"))
        return {
          ok: true,
          json: async () => ({ period: "all", managerView: true, rows: POINT_ROWS, meId: "m1", meRank: 1 }),
        };
      if (url.includes("my-points"))
        return {
          ok: true,
          json: async () => ({
            rows: [
              { session_id: "s1", points: 74, band: "solid", created_at: "2026-09-20T00:00:00Z" },
              { session_id: "s2", points: 88, band: "strong", created_at: "2026-09-21T00:00:00Z" },
              { session_id: "s3", points: 61, band: "solid", created_at: "2026-09-22T00:00:00Z" },
            ],
            total: 223,
            avg: 74,
            sessions: 3,
          }),
        };
      return { ok: true, json: async () => ({}) };
    })
  );

describe("capture", () => {
  it("scoreboard, both boards", async () => {
    stubBrowserApis();
    serve();
    const { container } = render(<ScoreboardPage />);
    // A row from the SECOND board. Waiting on a name from the first would go green while the
    // Activity Points board — the one carrying the band chips — was still empty.
    await screen.findAllByText(/Priya Raman/i, undefined, { timeout: 8000 });
    capture("scoreboard", container, { width: 1180, height: 1600 });
  });
});
