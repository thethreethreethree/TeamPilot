import { TodaysMetricsPager } from "@/components/sales-coach/TodaysMetricsPager";

/**
 * /dashboard/sales-coach/my-progress — Progress | Breakdown | Metrics.
 *
 * THE SAME COMPONENT THE REP USES, and that is the point of this file being three lines.
 *
 * I built a second sub-nav for this page (`RepDashboardTabs`) with the same three tabs, and then
 * found by sweeping rep-facing routes that this page's nav entry is `managerOnly` — so the rep it
 * was built for could not open it (A31). The tabs went into `TodaysMetricsPager`, which is the
 * surface a rep actually reaches, and the second implementation was deleted rather than left
 * beside it.
 *
 * Two tab lists over the same three boards is the §2.2 shape in a place types cannot see: both
 * would be correct the day they were written, and the first page added to one would silently not
 * appear in the other. One authority, two routes.
 *
 * A manager is also a rep here — they record their own pitches — so this route is their way to the
 * same dashboard from the desktop nav, and the pager's swipe simply goes unused with a mouse.
 *
 * Stays a SERVER component: route segment config is silently ignored in a `"use client"` file
 * (INVARIANT 27), so the state lives in the pager and this page keeps its exports.
 */
export default function MyProgressPage() {
  return <TodaysMetricsPager />;
}
