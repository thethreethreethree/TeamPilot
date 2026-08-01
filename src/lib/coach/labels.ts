/**
 * Shared Sales Coach display labels — the SINGLE source for feature names that appear in more than one place.
 *
 * Why this exists: the "Strategy → One Liners" rename drifted (2026-08-01) because the label was typed
 * literally in 4+ user-visible sites across 3 files (nav, home card, page title, section header, hint
 * category), and one was left mode-conditional — so in Expert mode the founder saw the OLD label and thought
 * the rename "didn't stick". Naming it once here means the next rename lands in ONE place, not five.
 * See docs/audits/2026-08-01-salescoach-stale-client-and-edits-diagnosis.md.
 */

/** The winning-lines library (route: /dashboard/sales-coach/strategy). Interpolate for compound forms:
 *  `Your ${ONE_LINERS_LABEL}`, `Sales Coach · ${ONE_LINERS_LABEL}`. */
export const ONE_LINERS_LABEL = "One Liners";
