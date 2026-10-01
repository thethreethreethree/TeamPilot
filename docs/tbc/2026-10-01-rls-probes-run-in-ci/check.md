# CHECK - RLS probes run in CI

## Commands

```
$ docker run -d --name pgprobe -e POSTGRES_PASSWORD=postgres postgres:16-alpine
$ MIGRATION_AUDIT_PSQL="docker exec -i pgprobe psql -U postgres" node scripts/migration-apply-audit.mjs
  Migrations applied:      266
  Failed on a fresh DB:    0
  Not re-runnable (NEW):   0
  RLS probes:              1 run, 0 failed
exit 0

$ (mutation: 0267's window changed to interval '600 minutes', same command, then restored)
  RLS probes:              1 run, 1 failed
✗ RLS PROBE FAILED  0267-door-knock-undos.rls.sql
    ERROR:  case 2: a 2-hour-old knock was undone; the 60-minute window is not enforced
exit 1
```

The full `npm run check` is appended below.

## Findings

### A committed RLS probe was never run by anything

class: a verification artifact that reports instead of failing, run only by hand
sweep: ls scripts/sql/probes; grep -rn "ON_ERROR_STOP 0" scripts/sql - each such file must end in an assertion block
severity: medium

## Not verified

- CI itself has not run it yet; the next push to main does. The local run uses the same image and script.

## Not opened

No image, icon, logo, favicon or graphic asset was touched.

## Appended — the full gate

```
$ MIGRATION_AUDIT_PSQL="docker exec -i pgprobe psql -U postgres" npm run check     (postgres:16-alpine)
  RLS probes:              1 run, 0 failed
      Tests  5592 passed | 15 skipped (5607)
CHECK_EXIT=0
```

Inside that run `sql:harness` printed SKIPPED: it connects over TCP and the container published no port. Run
separately against a container on a published port:

```
$ PGHOST=localhost PGPORT=55432 PGUSER=postgres PGPASSWORD=postgres npm run sql:harness
✓ 3 claim(s) checked against real Postgres.
exit 0
```
