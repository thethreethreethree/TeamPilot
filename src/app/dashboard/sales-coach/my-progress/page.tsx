import { RepArena } from "@/components/sales-coach/RepArena";
import { PitchBreakdown } from "@/components/sales-coach/PitchBreakdown";

/**
 * /dashboard/sales-coach/my-progress — the rep's own gamification arena (gauge / odometer / stats /
 * best pitches / milestones / recent bars), followed by their rubric Breakdown. Rep-facing (not
 * managerOnly); both read the caller's own data through owner-RLS. The SalesCoachShell layout
 * provides the nav.
 *
 * TWO BOARDS, IN THIS ORDER, matching the 2026-09-19 rep dashboard: Progress first — where the
 * rep stands — then Breakdown — why. The arena answers "how am I doing"; the breakdown answers
 * "what do I practise". Reversing them would open on a wall of thirty percentages before the rep
 * has any reason to care about them.
 *
 * The Breakdown renders its own loading, failed and empty states, so a rep with no scored pitches
 * yet sees an honest "none yet" beneath a working arena rather than a broken-looking page.
 */
export default function MyProgressPage() {
  return (
    <>
      <RepArena />
      <div className="px-4 md:px-8 pb-8 max-w-4xl mx-auto w-full">
        <PitchBreakdown />
      </div>
    </>
  );
}
