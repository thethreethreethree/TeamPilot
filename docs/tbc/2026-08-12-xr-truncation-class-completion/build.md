# BUILD — truncation-class completion (dashboard + CARE analytics + list)

## Feature inventory

### The three remaining truncation instances now page their reads
- write-path: none (read-only analytics/list). N/A.
- read-path: each previously-unbounded read now uses `fetchAllPaged` + a stable order, so the JS aggregations
  they feed see EVERY row instead of the first 1000 (or 5000):
  - `coach/sales-session/dashboard/route.ts` — the agent's sessions (`.order("id")`) → sessionsTotal + pipeline
    counts + cue-total correct past 1000 sessions. Fails loud + generic 500 on error (§3.4 + CWE-209).
  - `care/agent/analytics/route.ts` — the windowed support_conversations (`.order("id")`) → resolution rate +
    FRT median/buckets correct past 5000 window-conversations (the fixed `.limit(5000)` is gone).
  - `coach/sales-session/list/route.ts` — badge events (`.order("id")`) + signal events
    (`.order("created_at" desc).order("id" desc)`, preserving latest-wins) → no badge/signal drop past 1000 rows.
  Reachable via the Sales-Coach home (dashboard), the Sessions list, and the CARE agent analytics; the paged
  reads' behaviour is proven by the updated route tests.

## Files changed
- src/app/api/coach/sales-session/dashboard/route.ts — fetchAllPaged the sessions read; generic 500.
- src/app/api/care/agent/analytics/route.ts — fetchAllPaged the conversations (drop `.limit(5000)`).
- src/app/api/coach/sales-session/list/route.ts — fetchAllPaged the badge + signal event reads.
- src/app/api/coach/sales-session/dashboard/__tests__/route.test.ts — mock now models `.order().range()`.
- src/app/api/care/agent/analytics/__tests__/route.resolved.test.ts — mock now models `.order().range()`.

## Holistic (§1.5.1)
Behaviour-preserving except the truncation. The one non-mechanical case (list SIGNALS latest-wins order) is
handled by paging on (created_at desc, id desc). No schema/write changes. Completes the truncation class the
session swept (KPI HIGH fixed in xo; these three the remainder).
