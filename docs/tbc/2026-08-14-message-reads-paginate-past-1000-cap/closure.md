# CLOSURE — page the message reads past the 1000-row cap

## What shipped
Two confirmed unbounded message reads — team chat (`fetchMessages`) and C.A.R.E support
(`listCareMessagesForCustomer`) — silently truncated a >1000-message thread to the OLDEST 1000, hiding the
newest messages (an active channel looked frozen in the past; the AI read stale context). Both now read via
`fetchAllPaged` (pages past the cap, deterministic `.order("id")` tiebreaker, throws honestly on error).
Behavior-preserving — the whole thread, without the silent truncation. Founder-chosen shape (recent-N +
load-older stays a later optimization).

## Verification (A38) — full gate output
`npm run check` — full gate, exit 0:
```
typecheck ✓ · lint ✓ · theme:audit ✓ · rls:audit ✓ · invariant:audit ✓ (Violations 0)
tbc ✓ — docs · manifest · artifacts · residual · freshness
Test Files 413 passed | 1 skipped (414); Tests 2856 passed | 15 skipped (2871)
```

## Residual (A36)
```json
[
  { "id": "R1", "item": "fetchAllPaged loads the WHOLE thread into memory; a truly huge channel (10k+ messages) transfers all of it.", "why_skipped": "Behavior-preserving vs the prior intent (the old code TRIED to load all, just capped at 1000). The recent-N + load-older optimization (founder-deferred) is the answer at that scale; not reachable soon.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-14T03:35:00Z", "outcome": "Accepted; the load-older build is the follow-up." },
  { "id": "R2", "item": "tasks.ts per-task message reads share the class but weren't fixed here.", "why_skipped": "Lower reach (a task rarely exceeds 1000 messages) + outside the founder-scoped decision (the two message threads).", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-14T03:35:30Z", "outcome": "Flagged as a follow-up in build.md / check.md." }
]
```

## Un-named reliance
- Relies on "a short (< pageSize) page proves the end" (fetchAllPaged's contract) + a deterministic total order
  (`created_at, id`) so no row is skipped or duplicated at a page boundary. The `.order("id")` tiebreaker
  supplies the determinism the raw `created_at` order lacked.

## Status
Complete once the gate shows exit 0. Long threads show their newest messages again, and the AI reads current
context.
