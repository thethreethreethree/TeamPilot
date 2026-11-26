"use client";

import { CoachingInbox } from "@/components/sales-coach/CoachingInbox";
import { DisputeQueue } from "@/components/sales-coach/DisputeQueue";
import { UnscoredBacklog } from "@/components/sales-coach/UnscoredBacklog";
import { TeamUsage } from "@/components/remote-sales/TeamUsage";
import { TeamCallStats } from "@/components/remote-sales/TeamCallStats";
import { TeamCoverage } from "@/components/remote-sales/TeamCoverage";
import { BriefTemplatesManager } from "@/components/remote-sales/BriefTemplatesManager";
import { WeeklyRoutine } from "@/components/remote-sales/WeeklyRoutine";
import { TeamPicker } from "@/components/remote-sales/TeamPicker";
import { useEffect, useState } from "react";

/**
 * Remote Sales → Coaching: the coaching inbox and coaching metrics (plan Phase 4), and the score-dispute queue for phone
 * and video calls (2026-11-22, Gong F15.21). Before this, a remote rep's dispute surfaced only in Sales Coach → Coach
 * Assessment — outside the module the founder made separate. That queue now holds in-person disputes only.
 *
 * The unscored-calls backlog (2026-11-23, founder: keep scoring the backlog manual, make it visible): phone/video calls
 * that ended without a score — e.g. ones repaired by transcript recovery — are counted and drained here, not in Sales
 * Coach. The panel renders nothing for a rep (the route is manager-only) or when nothing is waiting.
 */
export default function RemoteSalesCoachingPage() {
  // One manager's team (F10.9 / F16.6), kept in the page URL (?team=) so a refresh or a shared link keeps it.
  const [team, setTeam] = useState("");
  useEffect(() => {
    setTeam(new URLSearchParams(window.location.search).get("team") ?? "");
  }, []);
  const pickTeam = (t: string) => {
    setTeam(t);
    const u = new URL(window.location.href);
    if (t) u.searchParams.set("team", t);
    else u.searchParams.delete("team");
    window.history.replaceState(null, "", u.toString());
  };
  const scoped = team || undefined;
  return (
    <div className="space-y-6">
      <TeamPicker value={team} onChange={pickTeam} />
      <WeeklyRoutine />
      <div id="unscored-calls" className="scroll-mt-20">
        <UnscoredBacklog module="remote_sales" />
      </div>
      <div id="coaching-inbox" className="scroll-mt-20">
        <CoachingInbox team={scoped} />
      </div>
      <TeamUsage team={scoped} />
      {/* Team call stats (F10.9, 2026-11-25): interaction stats per rep and for the team, 7 / 30 / 90 days. */}
      <TeamCallStats team={scoped} />
      {/* What the team's calls cover (F10.11, 2026-11-25): share of calls per tracker and per topic. */}
      <TeamCoverage team={scoped} />
      {/* Brief templates (F13.2, 2026-11-26): the questions a call should answer; run from a call's page. */}
      <BriefTemplatesManager />
      <section aria-label="Score disputes" id="score-disputes" className="scroll-mt-20">
        <h2 className="mb-2 text-sm font-semibold text-primary">Score disputes</h2>
        <DisputeQueue module="remote_sales" />
      </section>
    </div>
  );
}
