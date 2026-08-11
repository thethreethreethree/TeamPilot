# REMEDIATE — Signed-upload sign-endpoint audit

### F1 — files/upload-url raw mint-error leak (CWE-209)
fix: `console.error` the raw cause (with `auth.companyId` for triage) + return a generic 500 message,
mirroring the three sibling sign endpoints. `files/upload-url/route.ts:67-77`.
gate-or-promise: gate. `src/app/api/files/upload-url/__tests__/route.test.ts` asserts the failure-path body is
the generic string and contains neither "Supabase" nor "bucket" — the test fails if a future edit re-exposes
the raw `target.error`. It also gates the tenant property (mint under the caller's own companyId) and the
401-unauth path.
