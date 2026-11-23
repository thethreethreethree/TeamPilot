# REMEDIATE - Keep transcripts only

### F1 - the Protection screen showed a failed retention read as "Loading…" forever
Fixed: retFailed state shows "Couldn't load the retention setting" with Try again.
gate-or-promise: promise (no component harness for Settings screens — OPEN.md component-test entry)

### F2 - the cron's transcript check is one query per call
Bounded per run; the nightly volume is the day's calls for opted-in companies.
gate-or-promise: promise (OPEN.md "transcripts-only check is one query per call")
