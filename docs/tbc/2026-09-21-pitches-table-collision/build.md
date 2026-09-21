# BUILD

## The rename

| Old | New | Why |
|---|---|---|
| `pitches` | `pitch_scores` | collided with the Door Log's `pitches` (0215) |
| `pitch_elements` | `pitch_score_elements` | reads as family with the Door Log's `pitch_analyses` / `pitch_transcripts`, and is not |
| `pitch_events` | `pitch_score_events` | same |

Applied across migrations **0252, 0253, 0254** and the four TS files that name the tables. The
Door Log's own files — `doorlog.ts`, `worker.ts`, `rollupWorker.ts`, the report-card routes —
were deliberately untouched; they legitimately use `pitches`.

One thing the mechanical rename missed and a read caught: 0254's constraint name was still
`pitch_events_type_check`, which Postgres auto-generates from the table name. Now
`pitch_score_events_type_check`.

## Why edited in place rather than a new migration

Migrations are append-only *because they have run*. These have not — `create table if not exists`
was a no-op on any database with the Door Log, so 0252 died at the next statement. There is no
table for a 0255 to rename.

## The second symptom

`npm run rls:audit` went green → **9 missing policies** after the rename.

That is a revelation, not a regression. The audit tracks policies by table name, so my `pitches`
was inheriting the Door Log `pitches` insert/update policies. `pitch_scores.insert` and
`pitch_scores.update` had no coverage and no allowlist entry, and the audit could not tell the
two tables apart any more than the database could.

Three new allowlist entries, six renamed, each with its reason.

## INVARIANT 28

> two migrations must not `create table` the same name

No allowlist, because there is no legitimate instance: two create-table statements for one name
is a bug whatever the shapes are. Six self-tests cover the matcher (plain create, `if not
exists`, `public.`-qualified, not matching `create index`) and its wiring (the map is populated;
it knows the Door Log's `pitches`).

The wiring self-tests earned their place immediately. The first version of the loop iterated
`FILES`, which walks only `src/` for `.ts` — so it matched nothing and reported a confident zero.
The self-test caught it. **Second time today a self-test has caught a guard that silently stopped
looking.**
