# REMEDIATE - Training by deal stage

### F1 - the training screen showed a failed read as "No scenarios yet"
Fixed for TrainingManager's scenarios, assignments and stages read ("Couldn't load training" + Try again). The other 11
`r.ok ? r.json() : null` reads each need reading to tell a label read from a data read.
gate-or-promise: promise (OPEN.md "11 client reads map a failed fetch to null" — extend noFailedReadAsEmpty to the null form)

### F2 - free-text stage names can drift from tags
The tag box offers the stage names already used on prospects; matching ignores case and spacing.
gate-or-promise: promise (OPEN.md "stage names are free text")

### F3 - stage names read past the reporting tree, with false row bounds
Fixed before commit: caller's client for stage names; limits ≤ 1000; TREE_ROUTE_ALLOWLIST entry with its reason.
gate-or-promise: gate (invariant-audit INVARIANT 36 and the .limit > 1000 rule, both in npm run check)
