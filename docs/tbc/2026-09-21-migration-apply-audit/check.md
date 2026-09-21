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
EXIT=0
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

## Findings

Both were found by *running the tool*, not by reading it — which is the whole argument for A38.
A verifier that has never been executed on a second machine is a claim, not a check.

### F1 — the verifier reported SKIPPED on a machine that had Postgres running the whole time

class: a verifier whose unavailable-dependency path is indistinguishable from its pass path.
  The script hard-coded the maintenance database to `postgres`, which exists on a stock server and
  in CI but not on a container whose `POSTGRES_DB` is something else. It printed SKIPPED and exited
  0 — the exact false negative it was built to eliminate, in its own first run.
severity: high. Not because the skip is wrong (a developer must not be blocked) but because
  the machine *could* have run it. Every local run would have silently proven nothing, and the
  18-migration baseline would have been generated from nowhere.
sweep: `grep -rn "postgres" scripts/migration-apply-audit.mjs` and, for the general class,
  `grep -rln "SKIP\|SKIPPED" scripts/ | xargs grep -ln "exit(0)\|process.exit(0)"` — every gate
  that can exit 0 without having run must say so in its output.
fix: `MIGRATION_AUDIT_MAINT_DB`, and the SKIPPED banner now states *"This is not a pass."*

### F2 — the verifier could not be run at all on the machine that wrote it

class: an unrunnable verifier. The script assumed `psql` on PATH. Most developers here run
  Postgres in Docker, where there is none — so the tool shipped could not have been executed by its
  own author, which is the A38 failure in its purest form.
severity: high. A gate nobody can run locally is discovered to be broken in CI, at which
  point it is someone else's red build.
sweep: `grep -rn "spawnSync(\"psql\"\|execSync(\"psql\"" scripts/` — any tool shelling directly
  to a binary rather than an overridable command.
fix: `MIGRATION_AUDIT_PSQL` takes a full command, so `docker exec -i my-pg psql -U postgres`
  works. Both modes were then exercised (table above).

## The gate the findings were cleared against

Re-run after both fixes, on the machine that had reported SKIPPED:

```
═══ Invariant audit — lessons this codebase already paid for ═══
  Files scanned:        1049
  Documented exceptions: 38
  Violations:           0
EXIT=0
```

## What is NOT verified

- **The CI step has never run.** The YAML was edited and structurally checked for the service block
  and the step; no workflow has executed it. The first real run is the next push, and the likely
  failure mode is the service's health check or the `PG*` env wiring — loud, not silent.
- **The shim is hand-written**, so it can drift from real Supabase. It is small and grep-justified
  and a gap fails loudly.
- **The 18 non-re-runnable migrations are recorded, not fixed.** They remain a hazard if one ever
  half-applies live. The founder has since chosen a single new migration that makes all 18
  idempotent; that is a separate build and has not been done.
- **Applying is not behaving.** This proves the schema can be created. It does not exercise a
  single RLS policy, and does not claim to.
