# CHECK - sales coaching on sales calls only

## Commands

```
$ npx tsc --noEmit -p .                                                          exit 0
$ npx vitest run src/lib/coach/v5 src/app/api/coach/sales-session                Tests  1311 passed (1311)
$ node scripts/invariant-audit.mjs                                               Violations: 0
$ (mutation: the why route's isSalesCall guard removed)  invariant-audit         1 violation (restored)
```

The full `npm run check` is appended below.

## Findings

### Sales engines ran on meetings and huddles

class: a kind-specific engine reachable from a shared entry point with no kind check
sweep: every route.ts under src/app/api/coach/sales-session and the two shared entry points, read by hand; plus the backfill query
severity: high

A huddle earned 54 leaderboard points graded on opener, close and objections.

### The 54 huddle points: a correction row alone does not reach every reader

class: a reversal the readers do not consume (the leaderboard function counts sessions, average and best from session_score rows only; my-points and the weekly digest read session_score only)
sweep: every reader of agent_point_ledger (0243 leaderboard function, my-points route, weeklyDigest x2, bankPoints, rubric)
severity: low

A correction of -54 would fix the agent's total, but they would still show 24 sessions rather than 23, an average
about 0.9 high, and the huddle in their history. Their best score (71) is unaffected. Taken to the founder.

## Not opened

No image, icon, logo, favicon or graphic asset was touched.

## Full gate (2026-10-12)

```
$ MIGRATION_AUDIT_PSQL="docker exec -i pgprobe54 psql -U postgres" PGHOST=localhost PGPORT=54329 PGUSER=postgres PGPASSWORD=postgres npm run check
  Violations: 0 · RLS probes: 3 run, 0 failed · tbc:freshness ✓
  Test Files  735 passed | 1 skipped (736)
  Tests  5716 passed | 15 skipped (5731)
  exit 0   (no SKIPPED line: the migration audit ran against Postgres)
```

The first run (2026-10-10) was cut off when the session ended. The rerun used a new local container on port 54329,
because Windows now reserves 55415-55914 and the old one on 55433 would not start.
