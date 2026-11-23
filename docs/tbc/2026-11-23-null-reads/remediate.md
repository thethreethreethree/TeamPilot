# REMEDIATE - Failed reads shown as "none" (the null form)

### F1 - the first sweep covered src/components only
Fixed: the guard covers both trees and fails on any new null-form read.
gate-or-promise: gate (src/lib/__tests__/noFailedReadAsEmpty.test.ts "the null form of a failed read")

### F2 - RepArena's leaderboard read still maps a failure to null
Rank only; points (the data) fail loud.
gate-or-promise: gate (counted allowance in NULL_ALLOWED; a second such read fails)
