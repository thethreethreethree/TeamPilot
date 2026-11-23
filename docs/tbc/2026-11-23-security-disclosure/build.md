# BUILD - Vulnerability disclosure

Migration 0312 (applied). No env keys or dashboard settings.

### Report an issue (no account)
write-path: /.well-known/security.txt (Contact/Policy → https://elostate.com/security) → /security page →
SecurityReportForm → POST /api/security-report (rate limit 5 per 10 min; hidden "website" field drops bots; cleanReport)
→ service role insert into security_reports (sealed; no IP stored).
read-path: the reporter sees "received" with an 8-character reference; a failed save says so.

### Triage a report (founders)
write-path: sidebar → Security reports (vendorOnly) → /dashboard/admin/security (isVendorAdmin layout) → status buttons
→ PUT /api/admin/security-reports { reportId, status, note } (requireVendorAdmin) → append security_report_events.
read-path: GET /api/admin/security-reports → reports newest first with their latest status ("New" until acted on) and
the count of new ones; a failed read says "Couldn't load".
