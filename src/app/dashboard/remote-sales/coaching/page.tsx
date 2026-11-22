"use client";

import { CoachingInbox } from "@/components/sales-coach/CoachingInbox";
import { DisputeQueue } from "@/components/sales-coach/DisputeQueue";
import { UnscoredBacklog } from "@/components/sales-coach/UnscoredBacklog";

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
  return (
    <div className="space-y-6">
      <UnscoredBacklog module="remote_sales" />
      <CoachingInbox />
      <section aria-label="Score disputes">
        <h2 className="mb-2 text-sm font-semibold text-primary">Score disputes</h2>
        <DisputeQueue module="remote_sales" />
      </section>
    </div>
  );
}
