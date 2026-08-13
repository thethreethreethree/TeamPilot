# CLOSURE — dissect-backfill cost-loop backoff

## What shipped
A confirmed HIGH cost loop: the dissect-backfill re-ran a full ~20s LLM call on stuck no-signal sessions every
pass (cron cap burn + the manual "Generate missing" button's "remaining" frozen above 0, so "run until
remaining=0" could never complete — repeated immediate metered spend). Fixed with a founder-chosen backoff
(N=14): `runAndStoreDissect` emits a `coach.dissect_attempted` marker when the LLM ran but produced no signal,
and `runDissectBackfill` excludes sessions attempted in the last 14 days. Stuck sessions leave the `missing`
set (remaining → 0, cron stops re-spending) and re-enter after 14 days so a later corpus-trim can recover them.

## Verification (A38) — full gate output
`npm run check` — full gate, exit 0:
```
typecheck ✓ · lint ✓ · theme:audit ✓ · rls:audit ✓ · invariant:audit ✓ (Violations 0)
tbc ✓ — docs · manifest · artifacts · residual · freshness
Test Files 412 passed | 1 skipped (413); Tests 2855 passed | 15 skipped (2870)
```

## Residual (A36)
```json
[
  { "id": "R1", "item": "A best-effort attempted-emit that fails (transient DB error) leaves the session without a backoff marker → it may be re-run once more next pass.", "why_skipped": "Best-effort matches the existing dissect_generated emit; a single missed marker just re-checks once and re-emits — no permanent loop (the NEXT run's emit sets it).", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-14T03:05:00Z", "outcome": "Accepted — self-correcting on the next pass." },
  { "id": "R2", "item": "The 14-day window is a fixed constant, not per-company configurable.", "why_skipped": "A single sensible default (founder-chosen) bounds cost across all tenants; per-company tuning is unwarranted until a tenant needs it.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-14T03:05:30Z", "outcome": "Accepted; a config surface is a follow-up if ever needed." }
]
```

## Un-named reliance
- Relies on "agent turns ≥ MIN_AGENT_SEGMENTS ⟺ the dissect LLM ran" — true because generateSalesDissect
  short-circuits below MIN before the LLM, and the dissect is controlExempt (never suppressed). If the dissect
  gained a control-window gate, the attempted-emit condition would need to follow it (else a suppressed session
  would be wrongly backed off).

## Status
Complete once the gate shows exit 0. The dissect-backfill converges: no stuck session re-runs the LLM forever,
and the manual button can honestly reach remaining=0.
