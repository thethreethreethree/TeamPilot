# REMEDIATE — F1 truncation-class remainder

## F1 — page the three remaining instances
Root cause: JS-side aggregation over a PostgREST-capped read (1000, or the fixed 5000 on CARE analytics) →
wrong count/rate/badge on high-growth data.

Remediation (founder-authorized "fix them all", keeping c5fbd454):
- **dashboard** — the agent's sessions read wrapped in `fetchAllPaged` (`.order("id")`); the §3.4 fail-loud now
  keys on the paged read (`sessionsData === null`) and returns a GENERIC 500 (was leaking the raw pg error —
  CWE-209 bonus).
- **CARE analytics** — the windowed conversations read wrapped in `fetchAllPaged` (`.order("id")`), dropping the
  `.limit(5000)`; the median/percentiles need every row, so paging (not an exact-count) is correct.
- **list** — the badge-events read paged (`.order("id")`; error → the existing `badgesAvailable=false`), and the
  signal-events read paged on `(created_at desc, id desc)` to PRESERVE the latest-per-(session,kind)-wins rule
  (id-desc is the stable tiebreaker; id-only would break it).

Tests: the dashboard + CARE-analytics route-test mocks updated to model the `.order().range()` chain; they still
pin the counts (dashboard stats; resolution-rate ever-resolved contract). 9/9 green.

Outcome: fixed. class: `unbounded_select_silent_truncation_1000cap`, JS-aggregation variant — now closed across
the swept surface (KPI in xo; these three here). severity: medium/medium/low.
