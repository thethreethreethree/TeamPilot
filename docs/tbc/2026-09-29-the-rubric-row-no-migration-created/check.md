# CHECK — every pitch score in production was refused: the rubric row no migration created

## How it was found

The founder's folder (docs/ELOSTATE UPDATE 9-29-2026) held a screenshot of "Score them all" at pass 7 with
"0 done" and "10 could not be saved", and a rep page showing "18 scored calls" beside "Recordings (0)".
Production logs, de-duplicated by request id, 09-26 05:40 .. 09-28 03:57: **164** `[storePitchScore] rpc failed`
lines, every one `violates foreign key constraint "pitch_scores_rubric_version_fkey"`.

## Root cause [OBSERVED]

- `pitch_scores.rubric_version` references `rubric_config(version)` (0252:124).
- The scorer stamps `RUBRIC_VERSION = "attfiber-v1"` (rubric.ts:19, scorePitch.ts:260).
- **No migration inserts a rubric_config row.** Nothing reads the table (the rubric is served from rubric.ts),
  so nothing noticed until a save needed it.
- Production, read-only transaction: `rubric_config` rows **0**; `pitch_scores` rows **0** — ever.

## Correction to the record

The 09-29 appendix to 2026-09-25-the-ai-account-ran-out-of-credit/check.md said "the balance was topped up and
the backlog is scoring", inferred from zero `[scoreSession] threw` lines. A failed save does not throw — it
returns `store_failed` — so that absence proved nothing about storing. **Nothing has ever been scored.**

## Fix

`rubricConfigRow()` in rubric.ts builds the row from the rubric's own constants; migration 0268 is GENERATED
from it (30 elements, 13 bonuses, 5 violations), `on conflict (version) do nothing`.

## Commands

```
$ MIGRATION_AUDIT_PSQL="docker exec -i pg268 psql -U postgres" node scripts/migration-apply-audit.mjs
  Migrations applied:      266
  Failed on a fresh DB:    0
  Not re-runnable (NEW):   0
exit 0

$ (scratch db: shim + every migration except 0268, then the insert; then 0268, then the insert again)
--- BEFORE 0268 ---
ERROR:  insert or update on table "pitch_scores" violates foreign key constraint "pitch_scores_rubric_version_fkey"
DETAIL:  Key (rubric_version)=(attfiber-v1) is not present in table "rubric_config".
 rubric_config rows: 0
--- AFTER 0268 ---
 rubric_config rows: 1
 pitch_scores rows:  1
exit 0

$ npm run check
      Tests  5568 passed | 15 skipped (5583)
exit 0
```

## Findings

### A required config row existed only by hand, and was never made

class: a foreign key to a table that no migration seeds (external-config, §1.5.3, inside the database)
sweep: grep -nE "references [a-z_]+\((version|key|code|slug)\)" supabase/migrations/*.sql — then for each
target table, grep for an insert into it in supabase/migrations
severity: critical

### A drain reported "could not be saved" without saying why

class: a refusal reason that names the symptom, not the cause
sweep: grep -n "store_failed" src/lib/coach/pitchScore/scoreSession.ts src/components/sales-coach/UnscoredBacklog.tsx
severity: medium

The panel said "10 could not be saved" — true, and useless for diagnosis; the cause was in server logs only.

## Not opened

No image or graphic asset was touched. The founder's folder images were opened and described in the session.
