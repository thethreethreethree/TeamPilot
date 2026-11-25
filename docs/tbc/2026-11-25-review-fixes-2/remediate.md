# REMEDIATE - Fixes from the second review

### F1 - /status claimed "Working" for parts it never tested
gate-or-promise: gate (publicStatus.test.ts, StatusView.render.test.tsx)
### F2 - the CSV could set a role the Team page refuses
gate-or-promise: gate (setMemberRole.test.ts)
### F3 - a member with no role never got one by CSV
gate-or-promise: gate (teamCsv.test.ts)
### F4 - KPI labels from the button, not the data; stale responses could land
gate-or-promise: promise (no KPI page render test exists; residual R1)
### F5 - a response-time-only manager had no row
gate-or-promise: gate (CoachingInbox.metrics.render.test.tsx)
### F6 - growth summary didn't name its window
gate-or-promise: promise
