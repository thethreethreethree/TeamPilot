# CHECK - RSS Phase 7, and the first executed gate for Phases 0-7

## Commands

Each `npm run check` step, run one by one on this machine (Node v24.22.2) after the repairs below:

```
typecheck exit 0
lint exit 0
theme:audit exit 0
rls:audit exit 0
invariant:audit exit 0        (Violations: 0)
reachability:audit exit 0
writer:audit exit 0
enum:audit exit 0
migration:audit exit 0        SKIPPED — no reachable Postgres. NOT a pass; see the replay below.
sql:harness exit 0            SKIPPED — no reachable Postgres. NOT a pass; its three claims (0264 view, its
                              security_invoker, profile_departments RLS) went unchecked here; CI runs them.
test exit 0                   Test Files 775 passed | 1 skipped (776); Tests 5970 passed | 15 skipped (5985)
```

Before the repairs the first run reported: 11 type errors, 1 lint error, 10 invariant violations, 1 unreachable
module, 4 failing tests, and sql:harness crashing (exit 1) instead of skipping.

Stand-in for the two Postgres steps: every migration replayed in order into PGlite (PostgreSQL 16.4) with
scripts/sql/supabase-shim.sql, pgcrypto's `create extension` stripped (PGlite 0.2.17 lacks it; gen_random_uuid is
core in PG 13+), then 0271-0283 applied a second time:

```
shim ok
applied 281/281
re-applied 13/13
OK   scenario
OK   assignment insert
ERR  DUPLICATE assignment (expect 23505) → 23505 ... "training_assignments_once"
ERR  OLD upsert path (expect refused) → 0A000 INSERT with ON CONFLICT clause cannot be used with table that has INSERT or UPDATE rules
OK   due change
OK   attempt
OK   update assignment is a no-op      (due_at kept: true)
OK   notification training_attempted
ERR  notification bogus type (expect CHECK) → 23514 manager_notifications_type_check
exit 0
```

Not run: `npm run tbc` before this record existed (it checks this record); RLS allowed/refused cases for the 0282
policies as an executed test (the replay ran as superuser); the Phase 7 "Looked at" (needs D18 and a live database).

## Findings

### F1 - ON CONFLICT writes on append-only rule tables fail on every call
class: an `INSERT … ON CONFLICT` (supabase-js `.upsert`, ignoreDuplicates included) against a table carrying
`create rule … on update … do instead nothing`. Postgres refuses it (0A000), so the feature never stores anything,
while unit tests that mock `.upsert` pass.
sweep: node scratch sweep over every `.from("<rule table>").upsert(` in src and every `insert into <rule table> …
on conflict` in supabase/migrations (rule set replayed from the migrations, as INVARIANT 33 does) → 4 hits, all RSS:
tracker_hits (trackerScan.ts), session_interaction_stats (interactionStats.ts), session_follow_through
(followThrough.ts), training_assignments (assignments route). None in shipped code or SQL. Now permanent as
INVARIANT 33.
severity: critical
Root cause in the gate itself: INVARIANT 33 exempted `ignoreDuplicates: true` as "not an update" — wrong (PG 16.4
refuses it, executed above) — and its 240-char window missed the flag on long objects anyway.

### F2 - sql:harness reads a refused connection as reachable
class: an error reason that can be the empty string, used as a boolean. On macOS `localhost` is ::1 and 127.0.0.1;
a refused connect is an AggregateError with message "". The harness then built against nothing and crashed.
sweep: `grep -n "e?.message ?? e" scripts/*.mjs` → sql-harness.mjs:97 only (migration-apply-audit uses psql output).
severity: medium

### F3 - reads past PostgREST's 1000-row cap
class: `.limit(N > 1000)` read as complete. coaching-metrics (30-day sessions), followThrough.loadLines (transcript
lines), call search (text hits, tracker hits).
sweep: `npm run invariant:audit` (INVARIANT ".limit(N) with N > 1000") → 3 files, now 0.
severity: high

### F4 - hand-computed session length
class: ended_at − started_at outside conversationDurationSeconds (no cap on an unclosed session).
sweep: `npm run invariant:audit` → coaching-metrics route, library route; now 0.
severity: medium

### F5 - CSV formula guard duplicated
class: a CSV export with its own copy of the formula guard instead of toCsv → neutralizeCsvFormula (it also escaped
real negative numbers).
sweep: `npm run invariant:audit` (INVARIANT 1) → search export; now 0.
severity: medium

### F6 - internal id in a client error
class: CWE-209 — a TreeError message ("Reporting loop through <user id>") returned to the client.
sweep: `npm run invariant:audit` (CWE-209 rule) → set-manager route; now 0.
severity: low

### F7 - code never compiled or run
class: index access under noUncheckedIndexedAccess (11), `<a>` for an internal page (1), British spelling on screen
(4), a test missing the admin-client mock (3 cases), test fakes without `.range` after paging.
sweep: `npm run typecheck`, `npm run lint`, `npm run test` → all exit 0 above.
severity: low
