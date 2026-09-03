import { RepArena } from "@/components/sales-coach/RepArena";

/**
 * /dashboard/sales-coach/my-progress — the rep's own gamification arena (gauge / odometer / stats / best pitches /
 * milestones / recent bars). Rep-facing (not managerOnly); reads the caller's own points via owner-RLS. The
 * SalesCoachShell layout provides the nav.
 */
export default function MyProgressPage() {
  return <RepArena />;
}
