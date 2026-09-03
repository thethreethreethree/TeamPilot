import { Scoreboard } from "@/components/sales-coach/Scoreboard";

/**
 * /dashboard/sales-coach/scoreboard — the team leaderboard (gamification Phase 5). The SalesCoachShell layout
 * provides the nav; this page renders the board. Data comes from /api/coach/gamification/leaderboard (aggregates
 * only — per-session score detail stays rep-private).
 */
export default function ScoreboardPage() {
  return <Scoreboard />;
}
