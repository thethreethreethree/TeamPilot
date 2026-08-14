# BUILD — "Reviewed" from the durable event (dashboard counts + list filter)

### dashboard route — reviewed counts from the review event
read-path: `src/app/api/coach/sales-session/dashboard/route.ts` pages the agent's `coach.sales_review_generated`
events (actor-scoped), builds a reviewed-subject set, and derives `reviewedCount` (sessions with a review),
`awaitingReview` (ended AND not reviewed), `reviewsGenerated` (distinct reviewed sessions), `recentGrowth`.
write-path: none (read/aggregate). Replaces `status==='reviewed'` (never written) and the `.limit(50)` regen
count. Fail-loud preserved (reviews read via fetchAllPaged → throws → 500).

### list route — the "Reviewed" filter uses the review-event set
read-path: `src/app/api/coach/sales-session/list/route.ts` — for `status=reviewed` it fetches ENDED sessions and
keeps only rows whose `hasReview` (the review-event set) is true, instead of the DB `.eq('status','reviewed')`
that matched nothing.
write-path: none. "active"/"ended" filters unchanged.

## Test coverage
- `dashboard/__tests__/route.test.ts` (+3, happy-path updated): reviewed/awaiting from the review EVENT (not
  status); regeneration → reviewsGenerated=1 (≤ sessions); reviews-read error → 500.
- `list/__tests__/route.test.ts` (+1): the "reviewed" filter returns the ended session WITH a review event and
  drops the one without — not empty (the old bug).

## Out of scope (noted)
- team-analytics filters on `status IN ('ended','reviewed')` — unaffected (it treats both as "ended-or-later",
  and 'reviewed' simply never matches, so the set is exactly the ended sessions it intends).
- A rep past ~1000 SESSIONS makes the review-event actor scan large but not `.in`-bounded (actor-filtered), so
  the >1000 concern is milder than the subject-`.in` path; a server-side aggregate remains the eventual fix.
