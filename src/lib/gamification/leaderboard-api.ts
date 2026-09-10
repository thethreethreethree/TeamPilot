/**
 * Reading the team scoreboard.
 *
 * DIRECT, AND SO LIVE TODAY. The web goes through
 * /api/coach/gamification/leaderboard, but that route only calls the
 * `gamification_leaderboard` function — which is `security definer`, scoped by
 * `auth_company_id()`, and granted to `authenticated`. The phone calls the same
 * function with the same identity and gets the same rows.
 *
 * AGGREGATES ONLY, by construction. The function returns rank-level figures and
 * no per-session detail, so there is nothing here that could leak one rep's
 * private scores to another. That is the function's guarantee, not this file's,
 * which is why this file does not attempt a second privacy check to drift from
 * it.
 */
import { supabase } from '@/lib/supabase';

import { num, type LeaderboardRow, type Period } from './leaderboard';

export async function fetchLeaderboard(
  period: Period,
): Promise<{ rows: LeaderboardRow[]; failed: boolean }> {
  try {
    const { data, error } = await supabase.rpc('gamification_leaderboard', {
      p_period: period,
    });
    // Reported as a failure rather than an empty board: "nobody has scored yet"
    // and "we could not read it" are different things to tell a team.
    if (error || !Array.isArray(data)) return { rows: [], failed: true };
    return {
      rows: data.map((r: Record<string, unknown>) => ({
        agentId: String(r.agent_id ?? ''),
        fullName: typeof r.full_name === 'string' ? r.full_name : null,
        sessions: num(r.sessions),
        totalPoints: num(r.total_points),
        avgPoints: num(r.avg_points),
        bestPoints: num(r.best_points),
        deals: num(r.deals),
      })),
      failed: false,
    };
  } catch {
    return { rows: [], failed: true };
  }
}
