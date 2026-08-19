# Replace-the-week re-import — Remediate

### Fix: the commit is authoritative; the preview count is advisory-by-construction
what: no code change — the design already isolates the risk. The commit's `commitImport` recomputes the
supersede set from LIVE derived state inside the same transaction as the write, so the actual replace is
always correct regardless of the preview's warned number. The preview's `willReplace` is a best-effort
heads-up.

gate-or-promise: declined (A33). A gate here would require locking the schedule between preview and commit
(pessimistic locking) for a purely cosmetic warning — disproportionate. The hole is named: the pre-commit
warning can be momentarily stale under a concurrent edit; the write is never wrong (authoritative recompute +
atomic transaction), and the commit result reports the TRUE `shiftsSuperseded`. Accepted as a low-severity,
by-construction limitation.
