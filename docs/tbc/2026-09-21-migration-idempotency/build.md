# BUILD — 18 applied migrations, edited in place, under a founder decision

### Guards in the 18 files themselves

- write-path: `supabase/migrations/` — 18 files edited. 67 `drop policy if exists` before
  `create policy`; 6 existence-checked `create type`; 12 `drop trigger if exists`; 4 view
  drop-before-create; 1 constraint drop-before-add; 2 hand edits inside `DO` blocks.
- write-path: the two `DO` block edits are the ones no transform could reach. 0001 and 0002 build
  policies with `execute format('create policy "%1$s - all" on %1$s …', t)` in a loop — dynamic
  SQL, invisible to any regex over the file. The guard had to go **inside the generated
  statement**, as a second `execute format` emitting `drop policy if exists` first.
- write-path: every edited file is headed by the reason it was edited, so the next reader finds the
  decision rather than an unexplained divergence from what production ran.
- read-path: `npm run migration:audit` — **254 applied, 0 failed, 0 not re-runnable.**

### The baseline is empty, and the gate still bites

- write-path: `scripts/migration-apply-audit.mjs` — `NOT_RERUNNABLE_BASELINE` is now `new Set([])`,
  with the reason and an instruction to keep it empty.
- write-path: the script's own header docblock was rewritten. It still described 18 append-only
  migrations that "must not be edited", which was now false — a stale doc beside working code is
  the thing that gets read instead of the code.
- read-path: proven by planting `9999_probe_unguarded.sql` with a bare `create policy`. The gate
  reported `Not re-runnable (NEW): 1` and exited 1; the probe was removed and it returned to 0.
  An emptied baseline that had quietly stopped failing would look identical to this one.

### The view drops carry a warning aimed at a human

- write-path: 0135 and 0149 need `drop view … cascade`, because a later migration widens those
  views and `create or replace` cannot remove a column.
- write-path: a full replay is safe — the dependents are rebuilt by their own migrations, which run
  after. A **hand-run of 0135 alone** is not: it would drop views created in 0136, 0143, 0146,
  0174, 0175 and 0185 and not bring them back.
- write-path: so each drop carries a comment naming the exact dependent migrations. The dependency
  was checked rather than assumed — those six files each `create or replace view` over
  `fin_bill_summary` / `fin_invoice_summary`, and 0182/0191 over `fin_budget_variance`.
- read-path: the person most likely to hand-run one of these files is someone repairing a
  half-applied migration at 2am, which is precisely when a comment in the file beats a note in a doc.
