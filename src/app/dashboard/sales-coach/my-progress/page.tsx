import { RepDashboardTabs } from "@/components/sales-coach/RepDashboardTabs";

/**
 * /dashboard/sales-coach/my-progress — the rep's own dashboard.
 *
 * THREE TABS, matching the 2026-09-19 rep dashboard sheet: Progress | Breakdown | Metrics.
 *
 *   Progress   the Arena (gauge / odometer / stats / best pitches / milestones) plus the Pitch
 *              Score milestone strip — where the rep stands.
 *   Breakdown  the rubric averages, section by section — why.
 *   Metrics    the founder's 2026-08-19 Macro field read: Next-Door focus, the doors /
 *              conversations / sales trio, the score chart, the day's opportunities.
 *
 * The sheet names all three and draws only the first two; the Metrics tab's contents are the
 * existing Macro component by founder decision (2026-09-22) rather than anything inferred from the
 * word on the tab.
 *
 * THE ORDER IS AN ARGUMENT, not a layout. Where you stand, then why, then the field read. Opening
 * on the Breakdown would put thirty percentages in front of a rep before they have any reason to
 * care about them; opening on Metrics would answer a question they did not ask.
 *
 * TWO MILESTONE STRIPS SIT ON THE PROGRESS TAB, deliberately. The Arena's count SESSIONS on the
 * points ledger; the Pitch Score strip counts COUNTED PITCHES. A rep records sessions that never
 * qualify, so the two diverge permanently, and merging them would mean picking one denominator and
 * silently moving dates the Arena has already shown — dates derived from the immutable ledger
 * precisely so they cannot move.
 *
 * This page stays a SERVER component. The tab state lives in `RepDashboardTabs`, because route
 * segment config is silently ignored in a `"use client"` file (INVARIANT 27), and a page that has
 * to become a client component to hold a `useState` is a page that can no longer export one.
 */
export default function MyProgressPage() {
  return <RepDashboardTabs />;
}
