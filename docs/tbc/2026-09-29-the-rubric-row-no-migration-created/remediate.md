# REMEDIATE

### A required config row existed only by hand, and was never made

gate-or-promise: gate

`rubricConfigMigration.test.ts` fails if 0268's rubric differs from the code's (mutation: one point value changed
→ caught). The wider class — other foreign keys to never-seeded tables — is named in check.md's sweep and NOT yet
run (closure residual).

### A drain reported "could not be saved" without saying why

gate-or-promise: promise

Not changed in this build. Recorded as a residual: store_failed should carry the category of failure (a missing
config row is an operator fix, not a retry).

## Appended 2026-10-01 — the class sweep, run

The wider class (a foreign key to a row that no migration creates) was named here and not yet run. Run now:
every `references <table>(<column>)` in supabase/migrations, comments stripped, joined against every
`insert into <table>` in the migrations. Result: every referenced table except one is keyed by `id` and holds
rows the app creates at runtime, which is not this class. The only foreign key to a NATURAL key (a version,
code or slug the code writes as a constant) is `pitch_scores.rubric_version → rubric_config(version)`, which
0268 now seeds. References written without an explicit column resolve to `id`-keyed runtime tables too.
The class has one member, and it is fixed.
