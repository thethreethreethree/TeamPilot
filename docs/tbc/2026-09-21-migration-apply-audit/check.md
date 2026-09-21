# CHECK

## The audit, run for real

```
═══ Migration apply audit — the whole history, against real Postgres ═══
  Migrations applied:      252
  Failed on a fresh DB:    0
  Not re-runnable (known): 18
  Not re-runnable (NEW):   0

✓ All 252 migrations apply to a database shaped like production, and no NEW migration is
  non-re-runnable.
```

And both tables coexist on that database, which is the proof the earlier rename actually worked
against the real history rather than against a prelude I wrote:

```
 pitch_scores  pitch_score_elements  pitch_score_events  pitches
```

## Proven against the bug it was built for

The real 2026-09-21 collision was reinstated — `pitch_scores` renamed back to `pitches` in 0252:

```
  Failed on a fresh DB:    3
✗ CANNOT APPLY  0252_pitch_score_system.sql   ERROR: relation "pitch_scores" does not exist
✗ CANNOT APPLY  0253_store_pitch_score_rpc.sql
✗ CANNOT APPLY  0254_pitch_score_verdicts.sql
EXIT=1
```

Restored: 0 failures, exit 0. **This is the check that would have caught the defect in seconds**,
two days before it was found by asking a question about vocabulary.

## Both run modes exercised

| | Result |
|---|---|
| no Postgres reachable | `SKIPPED`, exit 0, and prints "This is not a pass." |
| Postgres via `MIGRATION_AUDIT_PSQL` | 252 applied, 0 failures, exit 0 |

## Gates

| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | clean |
| `npm run rls:audit` | 0 missing policies |
| `npm run invariant:audit` | **0 violations** |
| `npm run reachability:audit` | **0 unreachable** |
| `npm run migration:audit` | 252 / 0 / 18 known / 0 new |
| `npx vitest run` | **4,696 passed**, 15 skipped |

## What is NOT verified

- **The CI step has never run.** The YAML was edited and structurally checked for the service
  block and the step; no workflow has executed it. The first real run is the next push, and the
  likely failure mode is the service's health check or the `PG*` env wiring — loud, not silent.
- **The shim is hand-written**, so it can drift from real Supabase. It is small and grep-justified
  and a gap fails loudly — four migrations failed on the first run because `storage.buckets` was
  missing `file_size_limit`, which is that failure mode working.
- **The 18 non-re-runnable migrations are recorded, not fixed.** They remain a hazard if one ever
  half-applies live.
- **Applying is not behaving.** This proves the schema can be created. It does not exercise a
  single RLS policy, and does not claim to.
