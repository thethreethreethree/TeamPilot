# CLOSURE — Signed-upload sign-endpoint audit + CWE-209 fix

## What shipped
A §1.7 audit of every signed-upload "sign" endpoint (the four `createSignedUploadTarget` callers), on the
record: **three clean, one flagged and fixed.** Tenant safety is clean across all four — each mints under a
server-derived companyId at a fresh random path, so none can be steered to another company's prefix. The one
defect — `files/upload-url` returning the raw `createSignedUploadTarget` error string (CWE-209, the class the
other three already guard) — is fixed to log-raw-return-generic and locked by a new test (401 / own-companyId /
generic-not-raw).

## Un-named reliances (A35 — name them)
- **`buildStoragePath` always prefixes the server companyId + a fresh UUID.** The "no cross-company mint / no
  overwrite" conclusion rests on that layout; every sign endpoint passes a server companyId + `randomUUID()`.
- **`createSignedUploadTarget` returns `{ok:false, error}` (never throws) on mint failure.** The generic-error
  branch depends on that; a throw would surface as an unhandled 500 (still not a raw-string leak to the body).
- **The leaked string was config-hint severity, not a secret.** If `createSignedUploadTarget` were ever changed
  to include a token/credential in its error, the OLD code would have leaked it — the fix removes that future
  risk too.

## Residual (A36 — ranked by confidence-it-does-not-matter; top must be OPENED)
```json
[
  { "id": "R1", "item": "Other routes that return a custom { error: <backendString> } (not err.message) which the CWE-209 invariant misses because it keys on .message.", "why_skipped": "The sign-endpoint sweep found only files/upload-url in THIS class, but the invariant's .message-keying is a general blind spot that could hide the same pattern elsewhere.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-11T17:52:00Z", "outcome": "Grepped `return NextResponse.json({ error: <identifier>.error` / `{ error: <identifier> }` across src/app/api. The signed-upload mint (target.error) was the notable raw-object case; most { error: x } returns pass a controlled string literal or a validated `v.detail`/`auth.error` (recognised, non-raw). No second raw-backend-object leak found in the upload/sign surface. The general invariant-widening is a separate, broader change (R2)." },
  { "id": "R2", "item": "Widen the 'no raw error to client' invariant to also catch custom { error } fields, not only .message.", "why_skipped": "Widening risks false-positives on every route that legitimately returns a controlled { error: '...' } string; needs its own design + allowlist pass. A33 — don't ship a noisy gate. Named here + in the F2/internal-upload proposal lineage.", "confidence_it_does_not_matter": "medium", "opened_at": null }
]
```

## Gate result (`npm run check`)
```
$ npm run check
typecheck ✓ · lint ✓ · theme:audit ✓ · rls:audit ✓
invariant:audit ✓ — Violations: 0
tbc ✓ — docs · manifest (12) · artifacts · residual (2) · freshness all ✓
test ✓ — Test Files 389 passed | 1 skipped (390); Tests 2681 passed | 15 skipped (2696)
CHECK_EXIT=0
```
