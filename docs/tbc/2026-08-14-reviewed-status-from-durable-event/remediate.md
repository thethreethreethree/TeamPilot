# REMEDIATE — "Reviewed" from the durable event

## F1 — key reviewed/awaiting off the coach.sales_review_generated event
Remediation: the dashboard re-keys `reviewedCount` (sessions with a review event), `awaitingReview` (ended AND
not reviewed), and the list route's "reviewed" filter (ended rows with `hasReview`) off the durable
`coach.sales_review_generated` event — the SAME signal the list badge already uses — instead of a
`status='reviewed'` no code path writes. Generating a review now drains "Awaiting" and populates "Reviewed"
everywhere.
gate-or-promise: gate. Dashboard test asserts reviewed/awaiting from the review EVENT (a status read gives 0);
list test asserts the "reviewed" filter returns the event-backed session, not empty. Removing the event keying
reddens CI.
class: metric-keyed-on-mutable-status-nothing-sets. severity: high. Fixed (both surfaces).

## F2 — reviewsGenerated = distinct reviewed sessions (uncapped)
Remediation: `reviewsGenerated` is now the count of DISTINCT reviewed sessions (paged, uncapped), so it can never
freeze at 50 or exceed the session count.
gate-or-promise: gate. Dashboard test: a twice-regenerated session yields reviewsGenerated=1 and
`reviewsGenerated ≤ sessionsTotal`.
class: unbounded-truncation + wrong-grain. severity: medium. Fixed.
