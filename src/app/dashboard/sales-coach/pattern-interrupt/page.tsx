import { PatternInterrupt } from "@/components/sales-coach/PatternInterrupt";

/**
 * /dashboard/sales-coach/pattern-interrupt — Project 5 of the 2026-09-19 coaching build.
 *
 * Finds repeated misses across a rep's pitches, shows the clips that prove it, and tracks each
 * pattern until it is fixed. Role-branching, not manager-only: a manager gets the Patterns and
 * Rep progress tabs across the team, a rep gets the same Patterns screen limited to their own
 * (guide Step 6, "Rep web view"). Both roles have a working destination, so neither ever clicks a
 * nav item that bounces them (AMD-006 L3).
 *
 * The SalesCoachShell layout provides the nav and the access gate.
 */
export default function PatternInterruptPage() {
  return <PatternInterrupt />;
}
