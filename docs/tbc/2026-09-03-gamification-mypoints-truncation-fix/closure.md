# CLOSURE — my-points summary truncation fix

## What shipped
A correctness fix caught by the §1.5.2 outside-view audit of the gamification data path right after Phase 6.
my-points now computes the rep's total/avg/sessions over their FULL banked history (paged past the 1000-row cap),
matching the leaderboard's authoritative SUM, and returns only the most-recent 200 sessions for the trend. The old
`order(created_at ASC).limit(200)` both diverged from the board past 200 sessions AND surfaced the OLDEST 200 with a
stale total — the silent-truncation class.

## Verification (A38)
`npm run typecheck` clean; `my-points/__tests__/route.test.ts` → 4 passed (+1 for the >200 window case). Dormant in
the pilot, proven by test.

## The un-named reliance
- Relies on `fetchAllPagedResult` throwing (not returning partial) on a mid-page error, so a truncated set can never
  be summed as if complete — the route surfaces that as a 500.
- Relies on the owner-scoping predicates (agent_id, reason) being rebuilt on every page by the makePage factory —
  they are, inside the closure passed to the helper.

## Residual (A36 — explicit)
```json
[
  {
    "id": "GAM-R11",
    "item": "The summary sums the full history in JS after paging every row. A rep with a very large history (thousands of sessions) fetches many pages; a server-side aggregate RPC (SUM in SQL, fetch nothing) would be cheaper.",
    "why_skipped": "Pilot histories are tiny (<60 sessions); the paged read is correct and bounded by maxRows. The RPC is an optimization, not a correctness need.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-03T13:26:00+08:00",
    "outcome": "OPEN — convert to a server-side aggregate if a rep's history ever grows large."
  }
]
```
