# BUILD - Alert the founders to waiting security reports

No migration. No env keys.

### See that a report is waiting
write-path: none.
read-path: Sidebar (vendor-admin nav) → SecurityWaitingBadge → GET /api/admin/security-reports/waiting →
requireVendorAdmin → security_reports ids + security_report_events report_ids → waitingCount → amber count on
"Security reports" (hidden at zero or on a failed read); re-read on every navigation.
