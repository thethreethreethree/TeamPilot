# REMEDIATE - Tracker window: only the first N minutes

### F1 - an untimed line could be counted as "in the first minutes"
inWindow() returns false for a line with no time when a window is set; the form says so.
gate-or-promise: gate (trackers.test.ts)
