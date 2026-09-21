# REMEDIATE

### F1 — SKIPPED reported on a machine that had Postgres

fix: `MIGRATION_AUDIT_MAINT_DB` selects the maintenance database; the connection is attempted
  rather than assumed, and the SKIPPED banner now names what it tried and states *"This is not a
  pass."*
gate-or-promise: gate. CI provides a `postgres:16-alpine` service, so on the branch that
  matters the skip path cannot be taken — a regression that reintroduces the hard-coded database
  fails CI rather than passing quietly. The local skip stays deliberately non-blocking, which is
  why the banner carries the disclaimer: the honesty is in the *output*, and CI is what makes the
  check unavoidable.
residual: a developer who never pushes still gets no coverage. Accepted — the alternative is
  blocking every local `npm run check` on a Postgres install.

### F2 — the verifier could not be run on the machine that wrote it

fix: `MIGRATION_AUDIT_PSQL` takes a full command string rather than a binary path, so a
  containerised Postgres is reachable.
gate-or-promise: declined, with the hole named (A33). There is no automated check that a
  script is runnable on a machine other than CI's; writing one would mean simulating an
  environment, which is the same category of guess the shim already carries. What replaces it is
  narrower and real: **both modes were exercised before this shipped**, and the check.md table
  records which command produced which result. The hole is that the next tool to shell out to a
  binary can repeat F2, and nothing mechanical will stop it.
