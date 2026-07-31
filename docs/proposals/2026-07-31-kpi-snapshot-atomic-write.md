# Proposal — make the KPI snapshot write atomic (compute-cron)

**Status:** awaiting founder go/no-go (queue item "make the kpi snapshot write atomic").
**Trigger to execute:** founder says the word; this doc is the worked-up plan.
**Scope:** `src/app/api/coach/kpi/compute-cron/route.ts` + one new migration. No finance tables. KPI only.

## Diagnosis (§0 — earned, from the record)

The cron persists each agent's Layer-1/2 KPIs into `kpi_snapshot` via a **delete-then-insert pair**
per `(agent_id, metric, period)` (route.ts lines ~116–131): `delete().eq(agent).eq(metric).eq(period)`
then `insert({...})`. These are two separate round-trips with **no transaction**. Two failure modes:

1. **Non-atomic hole (Mode 1).** If the process dies or the INSERT errors *between* the DELETE and the
   INSERT, the row is gone with no replacement — that `(agent, metric, period)` snapshot is **missing**
   until the next successful run. The manager rollup (`/api/coach/kpi/team` reads precomputed rows for
   digests) sees a gap. Transient for `period='current'` (next run refills) but a real window of missing
   data; within-month for the `YYYY-MM` key.

2. **Scale / timeout (Mode 2).** `BATCH_AGENTS=100 × 6 metrics × 2 periods = 2,400 sequential
   delete+insert round-trips` under `maxDuration=60`. At ~25 ms/round-trip that is ~60 s — right at the
   ceiling. A timeout mid-loop leaves a **partial, inconsistent batch** (some agents fresh, some
   stale/holed) and returns no response.

**Root cause (the single fact both modes rest on):** `kpi_snapshot` has **no unique constraint** on
`(agent_id, metric, period)` — only a surrogate `id` PK and a non-unique index `kpi_snapshot_agent_idx`
(migration 0205). Without a conflict target you cannot `upsert`, so idempotency was achieved with the
delete-then-insert workaround. The workaround is what makes the write non-atomic and 2×-round-trip.

## Fix (two parts)

### 1. Migration (new, e.g. `0207_kpi_snapshot_unique.sql`)

- **Precondition:** dedupe any existing rows first (a delete-then-insert history should not have created
  duplicates, but a partial-failure run theoretically could). Keep the most recent `computed_at` per key:
  ```sql
  delete from public.kpi_snapshot a
  using public.kpi_snapshot b
  where a.agent_id = b.agent_id and a.metric = b.metric and a.period = b.period
    and a.computed_at < b.computed_at;
  ```
- **Add the constraint:**
  ```sql
  alter table public.kpi_snapshot
    add constraint kpi_snapshot_agent_metric_period_uniq unique (agent_id, metric, period);
  ```

### 2. Code (compute-cron route)

Replace the per-row delete-then-insert with a single **array upsert** for the whole batch (collect all
`agent × metric × period` rows into one array, one call), `onConflict: "agent_id,metric,period"`:

- **Atomic per row** — no delete-then-insert window → eliminates Mode 1.
- **~2,400 round-trips → 1 (or a few chunked)** → eliminates Mode 2's timeout risk.
- **Still idempotent** — upsert converges exactly like the old delete-then-insert.

Note: the upsert must write `value: null` for gated ("building") metrics too (current behavior — a gate is
a real recorded state, not a skipped row), which `upsert` does natively.

## Verification plan (when executed)

- Migration applies cleanly (`npm run db:dry` then `db:apply`); the dedupe deletes 0 rows on a clean table.
- A `verify:live` invariant: no duplicate `(agent_id, metric, period)` in `kpi_snapshot` (locks the
  constraint's intent, per the convert-verification-to-structural-guard discipline).
- Re-run the cron twice; assert row counts are stable (idempotent) and every agent has a full metric set
  (no holes).
- Existing `compute-cron/__tests__/route.test.ts` stays green (behavior-preserving: same rows, atomic write).

## Why gated (not self-applied)

It is a schema change (unique constraint) on a table the dormant/scheduled cron writes to. The founder
owns the call on when to apply a migration to the live KPI store. The diagnosis and plan are done so the
trigger is immediately actionable.
