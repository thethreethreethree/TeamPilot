# BUILD — Signed-upload sign-endpoint audit + CWE-209 fix

### files/upload-url returns a generic message on mint failure (`files/upload-url/route.ts:67`)
- write-path: on `createSignedUploadTarget` returning `{ ok:false }`, `console.error` the raw cause (with
  `auth.companyId` for triage) and return `500 { error: "Couldn't start the upload right now — please try
  again in a moment." }` — instead of the prior `{ error: target.error }` which echoed the raw
  backend/storage-config string. The happy path (target ok → `{ bucket, storagePath, token }`) is unchanged,
  and the storagePath's companyId is still `auth.companyId` (server-derived, never client input).
- read-path: the client receives only the controlled generic string on failure; the raw cause is readable only
  in the server log. Locked by the new test (`__tests__/route.test.ts`) asserting the response body is the
  generic string and contains neither "Supabase" nor "bucket", plus 401-unauth and mint-under-own-companyId.

**Audit-only, no code change — the other three sign endpoints.** Confirmed already correct: each gates the
mint behind an auth/tenant check at least as strong as its finalize and derives companyId from server auth. No
change; recorded in the think.md section-2 table + check.md.
