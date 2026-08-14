# CLOSURE — "Reviewed" from the durable event

## What shipped
"Reviewed" was permanently 0 and "Awaiting review" never drained, because the dashboard counts (and the Sessions
"Reviewed" filter) keyed on `status='reviewed'` — a status NO code path ever writes (the review route appends a
`coach.sales_review_generated` event and never advances status). Both surfaces now derive "reviewed" from that
durable event (the same signal the list `hasReview` badge already uses): generating a review drains "Awaiting"
and populates "Reviewed" everywhere, and `reviewsGenerated` is now distinct reviewed sessions (uncapped, ≤
sessions — no more 50-cap or reviews-exceed-sessions).

## Verification (A38) — full gate output
```
$ npm run check   (validated build dir: docs/tbc/2026-08-14-reviewed-status-from-durable-event)
typecheck ✓ · lint ✓
theme-leak audit — Theme-bound leaks: 0 ✓
RLS policy audit ✓ · Invariant audit — Violations: 0 ✓
tbc:docs ✓ · tbc:manifest ✓ · tbc:artifacts ✓ · tbc:residual ✓ · tbc:freshness ✓
Test Files  415 passed | 1 skipped (416)
     Tests  2870 passed | 15 skipped (2885)
exit 0
```

## Residual (A36)
```json
[
  { "id": "R1", "item": "A rep past ~1000 SESSIONS makes the actor-scoped review-event scan large (paged, not .in-bounded).", "why_skipped": "Milder than the subject-.in path (actor-filtered, no >1000-item filter); a server-side aggregate/RPC is the eventual fix for the whole dashboard, already flagged elsewhere.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-14T06:40:00Z", "outcome": "Noted." },
  { "id": "R2", "item": "Clock-drift artifact: started_at 06:30Z is ahead of the real clock (~02:00Z) to sort newest for the TBC dir-selector.", "why_skipped": "Ordering is honest; only the absolute value tracks the session's drifted clock. Documented in the reference_tbc_build_dir memory.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-14T06:40:30Z", "outcome": "Noted." }
]
```

## Un-named reliance
- Relies on the review event's `subject` being `sales_session:<id>` (the format the review route writes and the
  list route already parses) — the dashboard reviewed-set matches on that exact prefix.

## Status
Complete once the gate shows exit 0. "Reviewed"/"Awaiting" now reflect real review activity on every surface;
"Reviews generated" can no longer freeze at 50 or exceed the session count.
