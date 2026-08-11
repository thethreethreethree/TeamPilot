# CLOSURE — CARE readout unbounded-select paging

## What shipped
Four CARE §3.5 analytics readouts (coach-rubric cohort, voice-value cohort, co-pilot-usage cohort, durability
buckets) aggregated messages/checks across many conversations with an unbounded `.select()`, silently capped
by PostgREST at 1000 rows — so on an active account every conversation past the cap was misclassified
(defaulted to ungraded / voiceNotUsed / coPilotNotUsed / no-durability), i.e. the readouts that grade whether
the method works were measuring the wrong thing (§3.5). All four now page the full set via `fetchAllPaged` +
a stable uuid-`id` order, and fail loud on a read error (two previously swallowed it into an empty result).
Behaviour-preserving for small datasets (the coach-rubric DB-mock test is unchanged).

## Un-named reliances (A35 — name them)
- **Both tables have a uuid `id` PK.** Range pagination correctness depends on a unique, stable sort key;
  `support_messages.id` (0034) and `support_durability_checks.id` (0036) are both uuid PKs, verified in the
  migrations before ordering on them.
- **fetchAllPaged's maxRows backstop (200k) is above realistic window volumes.** A window whose messages
  exceeded 200k would throw rather than fetch unbounded — the honest failure, pointing at a server-side
  aggregate as the real fix at that scale.
- **The classification is idempotent per conversation.** Even if a created_at tie existed (it can't here — we
  order by unique id), a duplicated row would be harmless (Set/Map membership); the fix relies on completeness,
  which the id order guarantees.

## Residual (A36 — ranked by confidence-it-does-not-matter; top must be OPENED)
```json
[
  { "id": "R1", "item": "The single-conversation thread loads (getCareConversationByToken ~297, fetchAgentConversation ~726) are also unbounded — a thread past 1000 messages truncates, dropping the NEWEST messages (ordered created_at asc).", "why_skipped": "Lower likelihood (one support thread rarely exceeds 1000 messages) and the right fix is a UX pagination design (load latest N + load-older), not fetchAllPaged (a 5000-message thread in memory is its own problem) — a separate, larger change.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-12T00:45:00Z", "outcome": "Opened + assessed: confirmed both thread loads order created_at ASC with no limit, so truncation would hide the MOST RECENT messages (worse UX than the analytics case) — but the incidence needs a >1000-message single thread, which is rare, and the correct remedy is windowed pagination in the thread UI, not a bulk fetch. Documented as a follow-up UX item; NOT bundled here to avoid shipping a half-measure (a bulk fetchAllPaged of a giant thread). Surfaced for a dedicated pass." },
  { "id": "R2", "item": "A structural gate for 'unbounded .select() on a high-growth table'.", "why_skipped": "A33-declined: a static grep can't tell a bounded single-row/maybeSingle read from an at-risk aggregation, nor know a table's growth; it would false-flag legitimate reads. fetchAllPaged's runtime maxRows backstop + convention are the guardrail.", "confidence_it_does_not_matter": "medium", "opened_at": null }
]
```

## Gate result (`npm run check`)
```
$ npm run check
typecheck ✓ · lint ✓ · theme:audit ✓ · rls:audit ✓
invariant:audit ✓ — Violations: 0
tbc ✓ — docs · manifest (13) · artifacts · residual (2) · freshness all ✓
test ✓ — Test Files 392 passed | 1 skipped (393); Tests 2711 passed | 15 skipped (2726)
CHECK_EXIT=0
```
