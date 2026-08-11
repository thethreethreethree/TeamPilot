# CHECK — Signed-upload sign-endpoint audit + CWE-209 fix

## Verification run (A38 — canonical command + exit code)
```
$ npx vitest run "src/app/api/files/upload-url"
 Test Files  1 passed (1)
      Tests  3 passed (3)
VITEST_EXIT=0
$ npm run check
  Violations: 0
 Test Files  389 passed | 1 skipped (390)
      Tests  2681 passed | 15 skipped (2696)
CHECK_EXIT=0
```
The new test locks: 401 when unauthenticated (no mint), the target is minted under the caller's OWN
`auth.companyId`, and a mint failure returns the generic string (body contains neither "Supabase" nor
"bucket") rather than the raw `target.error`.

## Findings

### F1 — files/upload-url leaked the raw mint-error string to the client
file+line: `src/app/api/files/upload-url/route.ts:68` (pre-fix) — `return NextResponse.json({ error: target.error }, { status: 500 })` echoes `createSignedUploadTarget`'s string, which can carry backend/storage-config detail (e.g. "bucket does not exist — create it via the Supabase Dashboard…" or a raw Supabase message).
class: CWE-209 raw-backend-error-to-client — the same class the three sibling sign endpoints + F6 already guard (log raw, return generic). A16 apply-here-miss-there (this older route was the un-updated instance).
severity: low — authenticated-agent-only; the leaked string is a storage-config hint, not a secret.
sweep-command: `grep -rnE "NextResponse.json\(\s*\{\s*error:\s*[a-zA-Z_]+\.error" src/app/api` — swept every raw-error-object return; `target.error` was the only raw-backend-object case in the upload/sign surface (`auth.error`/`result.error`/`v.detail` are controlled app strings). Fixed here.

## Audit-clean (non-defect) — tenant safety of the mint
Swept all four `createSignedUploadTarget` callers: every one derives the storagePath companyId from server
auth (`conv.companyId` / `auth.companyId` / `getCurrentCompanyId()`), never from a client field, and mints a
fresh `randomUUID()` object — so no sign endpoint can be steered to mint under another company's prefix or
overwrite an existing object. No finding; recorded so this clean result is on the record (an empty flag list
is itself a suspicious finding worth stating explicitly, not silence).
