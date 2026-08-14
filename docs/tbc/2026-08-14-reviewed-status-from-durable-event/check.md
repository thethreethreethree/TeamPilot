# CHECK — "Reviewed" from the durable event

## Verification run (A38)
Canonical command: `npm run check`. Full-gate output + exit code in closure.md.

## Findings

### F1 — "Reviewed" is permanently 0 (dashboard + Sessions filter key on a status nothing writes)
file+line: `src/app/api/coach/sales-session/dashboard/route.ts` (reviewedCount/awaitingReview off
`status==='reviewed'`) + `src/app/api/coach/sales-session/list/route.ts` (`.eq('status','reviewed')`).
class: metric-keyed-on-mutable-status-nothing-sets (a durable event exists; the surface read a status no writer
sets → the number contradicts what the rep just did).
severity: high (the pipeline card tells the rep to generate reviews to drain "Awaiting", but the number never
moves; a manager's "Reviewed" filter is always empty).
sweep-command: `grep -rn "status.*reviewed\|=.*reviewed" src/app/api/coach/sales-session | grep -v "===\|in(" ` —
confirms no writer sets 'reviewed'; the counts + filter now derive from `coach.sales_review_generated`.
read-path: fixed — both surfaces key off the durable event (the same signal the list `hasReview` badge uses).

### F2 — "Reviews generated" caps at 50 and counts regenerations (can exceed sessions)
file+line: `src/app/api/coach/sales-session/dashboard/route.ts` (was `reviews.length` off a `.limit(50)` events
read).
class: unbounded-truncation + wrong-grain (counting regeneration EVENTS not reviewed SESSIONS).
severity: medium (a headline number freezes at 50 or shows reviews > sessions — reads as broken).
sweep-command: `grep -n "reviewsGenerated" src/app/api/coach/sales-session/dashboard/route.ts` — now = distinct
reviewed sessions (paged, uncapped, ≤ sessionsTotal).
read-path: fixed — reviewsGenerated = distinct reviewed sessions.

## Class sweep (A26)
The never-written-'reviewed'-status class has two consuming surfaces: the dashboard pipeline counts AND the
Sessions "Reviewed" filter. BOTH re-keyed off the durable event. team-analytics reads `status IN
('ended','reviewed')` where 'reviewed' simply never matches → the set is the ended sessions it intends, so it is
correct as-is (noted in build.md out-of-scope).

## Tests
```
$ npx vitest run "sales-session/list" "sales-session/dashboard"
 Test Files  2 passed (2)
 Tests  14 passed (14)
```
Dashboard: reviewed/awaiting from the event, reviewsGenerated ≤ sessions on regeneration, reviews-error → 500.
List: the "reviewed" filter returns the event-backed session, not empty. Full gate + exit code in closure.md.
