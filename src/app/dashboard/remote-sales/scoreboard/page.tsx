"use client";

import { MyProgress } from "@/components/sales-coach/MyProgress";
import { PitchLeaderboard } from "@/components/sales-coach/PitchLeaderboard";

/**
 * Remote Sales → Scoreboard (founder 2026-11-22: Remote Sales has its own scoreboard and points, separate from Sales
 * Coach). Points and the leaderboard from phone and video calls only — pitch_scores_by_channel /
 * agent_point_ledger_by_channel (0301). The board follows Sales Coach's rule: a manager sees every rep ranked; a rep
 * sees their own standing.
 */
export default function RemoteSalesScoreboardPage() {
  return (
    <div className="space-y-6">
      <MyProgress module="remote_sales" />
      <PitchLeaderboard module="remote_sales" />
    </div>
  );
}
