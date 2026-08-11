# CHECK — Customer upload honest-partial

## Verification run (A38 — canonical command + exit code)
```
$ npx vitest run "src/app/api/care/conversations"
 Test Files  11 passed (11)
      Tests  47 passed (47)
VITEST_EXIT=0
$ npm run check
  Violations: 0
 Test Files  388 passed | 1 skipped (389)
      Tests  2678 passed | 15 skipped (2693)
CHECK_EXIT=0
```
The new test asserts the customer finalize returns 502 (with the file row) when `postCustomerMessage` resolves
`null`; the happy-path test still returns 200 and records the REAL stored size/type, confirming the success
path is unchanged.

## Findings
**No findings.** This build IS the remediation of a finding from the F2 build's adversarial review (a
pre-existing §3.4 honesty asymmetry), and the fix is locked by a test. Known boundary (not a defect): on the
502 path the customer retries by re-uploading, which creates a second file row — identical to the agent tail's
retry behavior and acceptable (the alternative, resuming a half-attached upload, is more complexity than an
internal recoverable case warrants). Carried to the residual.
