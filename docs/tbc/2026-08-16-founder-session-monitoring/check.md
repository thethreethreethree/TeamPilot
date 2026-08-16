# CHECK — founder session-monitoring (0214 exemption)

## Verification run (A38)
Canonical command: `npm run check`. Full output + exit code in closure.md. DB precondition
applied via `npm run db:apply` (output + exit in closure.md).

## Findings
**No findings.** No defects found in verification. This is a feature build, not a bug audit; the checks below confirm the
build meets the requirement and the security-critical gate/allowlist/audit contract holds (tests + RLS
audit + invariant audit all pass). The one accepted risk (a genuine tenant-isolation exemption) and its
mitigations are recorded as residuals in closure.md, not as defects.

## What was built vs. the requirement
Requirement: the two founders monitor sessions for EXISTING companies only; new customers excluded;
customer isolation not broadly weakened; accountable.

- Vendor-only surface (requireVendorAdmin) — non-vendor is 403; shell is notFound(). ✔ by test + layout.
- Allowlist = existing companies (seed-from-`companies`, no trigger) — new tenants excluded. ✔ by migration.
- Audited — every read writes vendor_monitoring_access_log. ✔ by test (exact audit call asserted).
- Customer RLS untouched — coaching policies unchanged from 0083/0084. ✔ (no policy edits in 0214).

## Tests
```
$ npx vitest run src/app/api/admin/monitoring
 Test Files  1 passed (1)
 Tests  9 passed (9)
```
Full gate + exit code in closure.md.

## Invariant audit
```
$ node scripts/invariant-audit.mjs
  Files scanned: 793 · Documented exceptions: 35 · Violations: 0
```
The new admin routes satisfy "every admin route gated" (requireVendorAdmin) — no new exception entry needed.
