# BUILD — founder session-monitoring (0214 exemption)

### Migration — the allowlist + audit trail
read-path: `supabase/migrations/0214_vendor_monitoring_scope.sql`. Creates `vendor_monitoring_scope`
(the allowlist) seeded from `select id from companies` AT APPLY TIME (existing-only; no trigger adds
new companies) and `vendor_monitoring_access_log` (append-only audit). Both RLS-gated to
`is_vendor_super_admin()` (0089) — no customer read/write.
write-path: applied via `npm run db:apply` (never hand-applied). Strictly additive; grants nothing to
customer users; fails CLOSED if the vendor id is mis-set.

### Data layer — contained service-role reads
read-path: `src/lib/monitoring/vendorMonitoring.ts`. `isCompanyMonitorable` (the single allowlist gate),
`listMonitorableCompanies`, `listCompanySessions`, `getMonitoredSession` (returns null unless the
session's company is monitorable), `logMonitoringAccess` (audit writer).
write-path: every cross-tenant read funnels through `isCompanyMonitorable`; the module is READ-ONLY on
customer data (only writes the audit log). Service-role, server-only — never in a client bundle.

### API — vendor-gated, allowlisted, audited
read-path: `src/app/api/admin/monitoring/{companies,sessions,session/[id]}/route.ts`. Each:
`requireVendorAdmin` (= admin of vendor company = the two founders) → allowlist check → read → `logMonitoringAccess`.
write-path: a non-vendor caller is 403 (identical message to the CRM gate — no existence leak); a
non-allowlisted company/session is 404 (cannot probe non-scoped tenants); every success writes an audit row.

### UI — usable + honest surface (§3.4 layer-4)
read-path: `src/app/dashboard/admin/monitoring/{layout,page}.tsx`. Server layout mirrors the CRM vendor
gate (`notFound()` for non-vendor — no shell/existence leak). Client page drills companies → sessions →
transcript against the three APIs.
write-path: read-only; a banner states every opened session is recorded to the audit log — oversight, not
a hidden backdoor.

## Test coverage
`src/app/api/admin/monitoring/__tests__/route.test.ts` (9): non-vendor→403 (all three), missing
companyId→400, non-allowlisted→404 with NO audit write, success→200 WITH the exact audit call
(actor/company/session). Pins the security-critical gate/allowlist/audit contract.

## Notes
- No customer-facing RLS changed; the exemption is contained to the vendor surface.
- "Existing companies only" is structural (seed-from-existing, no trigger), not a comment.
- The DB apply is the one irreversible prod step — founder-approved to run end-to-end this session.
