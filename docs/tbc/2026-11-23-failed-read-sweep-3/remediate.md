# REMEDIATE - Third sweep: failed reads shown as "none"

### F1 - team password dialogs: a failed read read as "no team password yet — create one"
Failed state with its own message in both dialogs.
gate-or-promise: gate (noFailedReadAsEmpty else-form guard + PasswordDialogs.failedRead.render.test.tsx)

### F2 - a call's page: a failed review read offered a paid "Generate growth review"; a failed "why" read reopened the append-only composer
Per-part failed flags; generate held with a visible reason; composer hidden; summary card says it couldn't load.
gate-or-promise: gate (SessionDetailView.failedParts.render.test.tsx, mutation-checked)
