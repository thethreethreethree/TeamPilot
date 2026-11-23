# REMEDIATE - Make and edit topic groups by hand

### F1 - a new record dir with no think.md let every TBC gate pass on the PREVIOUS build
tbc:freshness now fails any record dir in the change that has no think.md and no git history (lib.mjs
newDirsWithoutThink). Old dirs without one stay exempt.
gate-or-promise: gate (scripts/tbc/__tests__/newDirsWithoutThink.test.ts; probed against a staged dir)
