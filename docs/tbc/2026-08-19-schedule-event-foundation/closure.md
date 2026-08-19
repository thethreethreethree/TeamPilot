# Phase 1 — Closure

## Verdict
Phase 1 (Event Store & Derivation Foundation) is **SHIPPABLE as a foundation**. Layer-1 (schema +
derivation) and layer-2 (works when invoked as a real caller would — append RPC + paged GET +
deterministic replay) are proven. Layers 3–4 are inter-phase / UI, explicitly out of Phase-1 scope.

## Acceptance (build plan Phase 1) — met
- ✅ Appending events + replaying yields correct derived state — `deriveState.test.ts` full-log replay.
- ✅ A correction is a NEW event, no in-place edit in the code path — assign→unassign test; DB has no
  UPDATE path (raise-trigger + revoke); the append route only ever inserts.
- ✅ Full history intact — append-only enforced at the DB, verified live (verify:live 27/27 after apply).
- ✅ Replay reproduces identical state — determinism + order-independence + purity tests.

## Changed
- Migration `0220` applied via `npm run db:apply` (ledger-recorded, not hand-applied). Additive only —
  a new table + trigger + function + RLS; no existing table touched. Founder approval: SOUGHT (the build
  was authorized; this is Phase 1 of the approved plan).

## Not completed (correctly out of Phase-1 scope)
- Constraint predicates / coverage math — **Phase 2**.
- The single verdict authority — **Phase 3**.
- LLM parsing + proposals — **Phase 4**.
- Manager + employee UI — **Phases 5–6**.
- Materialized derived-state tables — deferred until a read-consumer exists (D2 / A31).

## Residual queue (A36 — schema'd; read from the TOP of the confidence ranking)

```json
[
  {
    "id": "RQ1",
    "item": "D2 — deferring materialized derived-state tables (pure projector only in Phase 1).",
    "why_skipped": "A31 forbids schema with no read-consumer; the pure projector meets Phase-1 acceptance. Most sure this does not matter, so opened per A36.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-19T00:58:00Z",
    "outcome": "OPENED + confirmed safe: deriveState.test.ts proves Phase-1 acceptance (append + replay -> identical state) is met by the pure projector with zero persisted projection. A persisted table now would be A31 dead schema until a Phase 5/6 reader exists. Defer stands; revisit when a consumer needs a materialized read."
  },
  {
    "id": "RQ2",
    "item": "A permanent verify:live invariant so schedule_event's append-only enforcement cannot be silently dropped by a future migration.",
    "why_skipped": "Originally deferred to Phase 8; PULLED FORWARD — A30 says a fix is not complete until gated, and the verify:live registry was blind to schedule_event's trigger model (it only tracked no_update/no_delete rules).",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-19T01:15:00Z",
    "outcome": "DONE: added category (d) to the verify:live append-only registry check (asserts the schedule_event_no_update_delete trigger is present). Registry now reports 'all 23 tables'; verify:live passes 27/27; registry doc synced. A future migration dropping the trigger now FAILS verify:live."
  },
  {
    "id": "RQ3",
    "item": "DeepSeek + per-environment Supabase config (A41) fail-loud guards.",
    "why_skipped": "No LLM in Phase 1; becomes a blocking precondition at Phase 4, documented + fail-loud then.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null
  },
  {
    "id": "RQ4",
    "item": "Org timezone (A41) — no companies.timezone column exists (verified absent).",
    "why_skipped": "Shift-time correctness (across-midnight, coverage windows) begins in Phase 2; add companies.timezone + backfill + flag as a blocking setup step then.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null
  },
  {
    "id": "RQ5",
    "item": "Q5 — employee model (existing profiles/user vs lightweight record with optional user_id). BLOCKS Phase 2.",
    "why_skipped": "Phase 1 treats employeeId as an opaque UUID (decision-independent here); Phase 2 needs the entity. Recommend a lightweight employee record with an optional user_id link. Founder decision needed before Phase 2.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null
  },
  {
    "id": "RQ6",
    "item": "SECURITY — the append API gates on auth + company but NOT on role-per-event-type. Any authenticated company user can POST any event, including TIMEOFF_APPROVED (self-approve) or SHIFT_PUBLISHED (manager-only).",
    "why_skipped": "Phase 1 is pure event-plumbing; per-event-type authorization belongs to Phase 3 (the verdict authority gates consequential appends) + Phase 5/6 (manager vs employee interfaces expose only role-appropriate actions). Surfaced now (proactive audit, section 1.5.2) so it is a HARD requirement, not a late discovery: an employee must not self-approve time-off or publish/assign shifts via a direct API call. MUST be closed before the write paths are user-exposed.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null
  }
]
```

## Checkpoint (build plan Phase 1)
> "Confirm event-sourcing discipline before building rules."

Confirmed: the log is immutable (DB-enforced, fail-loud), state is derived by a pure replay, corrections
are new events, replay is deterministic. **Awaiting founder confirmation to proceed to Phase 2** (and the
Q5 employee-model decision, which Phase 2 needs).

## Verification
See `check.md` — the `npm run check` block (coverage + exit code, A38).
