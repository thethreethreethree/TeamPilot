import { RepArena } from "@/components/sales-coach/RepArena";
import { PitchBreakdown } from "@/components/sales-coach/PitchBreakdown";
import { PitchMilestones } from "@/components/sales-coach/PitchMilestones";

/**
 * /dashboard/sales-coach/my-progress — the rep's own gamification arena (gauge / odometer / stats /
 * best pitches / milestones / recent bars), followed by their Pitch Score milestones and their
 * rubric Breakdown. Rep-facing (not managerOnly); all three read the caller's own data through
 * owner-RLS. The SalesCoachShell layout provides the nav.
 *
 * THREE SECTIONS, IN THIS ORDER, matching the 2026-09-19 rep dashboard: Progress first — where the
 * rep stands — then Milestones — what they have reached — then Breakdown — why. The arena answers
 * "how am I doing"; the breakdown answers "what do I practise". Reversing them would open on a
 * wall of thirty percentages before the rep has any reason to care about them.
 *
 * TWO MILESTONE STRIPS ON ONE PAGE, and that is deliberate rather than an oversight. The Arena's
 * strip counts SESSIONS on the points ledger; this one counts COUNTED PITCHES. A rep records
 * sessions that never qualify, so the two diverge permanently and the same rep reaches them on
 * different days. Merging them would mean picking one denominator and silently moving every
 * earned-at date the Arena has already shown — and those dates are derived from the immutable
 * ledger precisely so they cannot move. So both stand, each saying what it counts, which is the
 * same resolution the scoreboard page uses for its two leaderboards.
 *
 * Each section renders its own loading, failed and empty states, so a rep with no scored pitches
 * yet sees honest "not yet" badges beneath a working arena rather than a broken-looking page.
 */
export default function MyProgressPage() {
  return (
    <>
      <RepArena />
      <div className="px-4 md:px-8 pb-8 max-w-4xl mx-auto w-full space-y-8">
        <PitchMilestones />
        <PitchBreakdown />
      </div>
    </>
  );
}
