# BUILD - RLS probes run in CI

### The probe fails by itself

- **write-path:** `scripts/sql/probes/0267-door-knock-undos.rls.sql` ends in a `do $assert$` block under
  `\set ON_ERROR_STOP 1`: 2 fixture reps; knock 1 undone exactly once (cases 1 and 5); knocks 2 and 3 never
  (cases 2-4); one undo row in total; raw 3, live 2 (case 6).
- **read-path:** against a weakened migration (window 600 minutes) it stops with
  `case 2: a 2-hour-old knock was undone; the 60-minute window is not enforced`.

### The migration audit runs every probe

- **write-path:** `scripts/migration-apply-audit.mjs` PASS 3: per probe, `create database <db>_probe template
  <db>`, run, drop; the stopping ERROR line is reported. The summary prints `RLS probes: N run, M failed`, and
  any failure exits 1.
- **read-path:** CI's existing "Migration apply audit" step (ci.yml) runs the script against postgres:16-alpine.
