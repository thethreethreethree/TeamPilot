# BUILD - Fixes from the second review

No migration. No env keys.

### Status, team CSV, KPIs, coaching
write-path: CSV role change → setMemberRole (now refuses roles the Team page can't set); everything else read-only.
read-path: /status shows "No problems detected" and "Switched on" for unprobed parts; the CSV preview shows a role
change for a member with no role; KPI cards and the growth summary name the window of the numbers on screen (latest
request only); the KPI CSV has a Window column; a manager whose only coaching was answering requests has a row.
