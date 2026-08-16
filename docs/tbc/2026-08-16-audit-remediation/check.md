# CHECK — 2026-08-16 audit remediation

## Verification run (A38)
Canonical command: `npm run check`. Full output + exit code in closure.md.

## Findings
**No findings.** This build REMEDIATES the audit's findings (#1-#7); verification confirms each fix holds and
no regression was introduced. The remediated items and their fixes are inventoried in build.md; the accepted
deferral (#8) and informational notes are recorded as residuals in closure.md, not as defects.

## What each fix confirms (checked)
- **#1** `notRecordingBanner` unit test: STT-error+capturing never says "nothing is being captured"; mic-denied case
  still honestly does. `audioCapturing` set only at the recorder's real start/stop.
- **#2** INV25 passes with the fence; detection tamper (remove import+usage) → Violations: 1; restored → 0.
- **#3/#4** monitoring route test: 503 (transcript withheld) when audit write returns false; data-layer boundary
  test: off-allowlist → null/[] and segments never queried.
- **#5** forced-cue rethrow → 502 path; auto path unchanged (returns silent).
- **#6** invite links build from `siteUrl()`; **#7** drift-guard asserts 0089 literal == VENDOR_COMPANY_ID.

## Tests
```
$ npx vitest run notRecordingBanner vendorMonitoring vendorCompanyId.sync src/app/api/admin/monitoring
 Test Files  4 passed (4)
 Tests  20 passed (20)
```
Full gate + exit code in closure.md.
