# REMEDIATE - A manager can mark a rubric item "Doesn't apply"

### F1 - the aggregate counted any grade that wasn't hit or partial as a miss
Explicit `missed` branch; N/A moves no rate.
gate-or-promise: gate (ElementGrade type + enum-source audit; aggregate typed on it)

### F2 - marking a whole section N/A would leave nothing to score it out of
leavesSectionAllNa → 422 with a plain message.
gate-or-promise: gate (applyOverride.test.ts)

### F3 - an earlier residual called patterns' in-person-only rule a gap
Correction appended to OPEN.md.
gate-or-promise: promise
