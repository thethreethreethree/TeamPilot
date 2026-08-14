# CLOSURE — care team/agent growth counts → exact head count

## What shipped
`fetchTeamGrowth` + `fetchAgentGrowth` computed their counts by SELECTing rows then `.length`, which PostgREST
caps at 1000 — so past 1000 rows/window the growth metrics silently under-reported (§3.4 — a guessed-low
number). The pure counts (agents, resolutions, claimed/awaiting conversations, agent replies) in both functions
now use a server-side exact `head:true` count (the pattern already used elsewhere in this file). Behavior-
preserving, no cap. Founder-scoped to the pure counts; the value reads (durability/edits/coach sums) are a noted
follow-up (they need the row values).

## Verification (A38) — full gate output
`npm run check` — full gate, exit 0:
```
typecheck ✓ · lint ✓ · theme:audit ✓ · rls:audit ✓ · invariant:audit ✓ (Violations 0)
tbc ✓ — docs · manifest · artifacts · residual · freshness
Test Files 414 passed | 1 skipped (415); Tests 2857 passed | 15 skipped (2872)
```

## Residual (A36)
```json
[
  { "id": "R1", "item": "The VALUE reads (durability outcomes, copilot edit magnitudes, coach_counts sums) still fetch rows and cap at 1000.", "why_skipped": "They need the row VALUES, not a count — a different fix (fetchAllPaged / server-side aggregate). Founder scoped this change to the pure counts; the narrowed `bounded` flag still warns if a value read caps.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-14T04:05:00Z", "outcome": "Flagged as a follow-up in build/check/remediate." },
  { "id": "R2", "item": "The agentReplies count in fetchTeamGrowth uses an embedded-resource (support_conversations!inner) filter with head:true; the count semantics rely on PostgREST counting the matching parent rows.", "why_skipped": "The head:true embedded-filter count is the same feature used elsewhere in care.ts; verified by typecheck + the unit test's mocked count. A live-DB check would confirm the exact number, unavailable in the sandbox.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-14T04:05:30Z", "outcome": "Accepted; verify on live data when convenient." }
]
```

## Un-named reliance
- Relies on "head:true returns the count of rows matching the (possibly embedded-filtered) query" — the standard
  PostgREST exact-count behavior the codebase already depends on (care.ts:224/646/2902).

## Status
Complete once the gate shows exit 0. Team/agent growth counts are exact past 1000/window; the value-derived
rates remain a flagged follow-up.
