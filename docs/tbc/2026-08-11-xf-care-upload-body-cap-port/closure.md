# CLOSURE — C.A.R.E upload body-cap port (F2)

## What shipped
Both C.A.R.E conversation uploads now go DIRECT to Storage via a signed target, bypassing Vercel's ~4.5 MB
serverless body limit that silently killed any real phone photo / scanned PDF. New `…/sign` endpoints on each
route (customer + agent) mint the target after the same auth + conversation + size/type/ext gate the multipart
branch enforced; a JSON finalize branch on each existing route re-reads the REAL stored object (untrusted
client claim), enforces the companyId-prefix check (audit F1) and re-validates size/type before recording the
attachment. The multipart branch is kept as a small-file fallback and now shares one attach-tail per route
(`attachCustomerFile` / `attachAgentFile`), so the two entry points can't drift. The shared `FileDropzone`
gained an opt-in `signEndpoint` prop (the agent composer's dropzone passes it); its four other callers are
byte-for-byte unchanged.

## Un-named reliances (A35 — name them)
- **The browser can reach Supabase Storage directly.** `uploadToSignedUrl` PUTs from the client to the storage
  host. If a customer's network blocks that host, the upload fails (generic retry message) — but it fails
  strictly LESS often than the through-function path, which failed for every >4.5 MB file regardless of
  network.
- **`getAssetObjectInfo` reports the true stored size/type.** The finalize's authoritative re-validation
  trusts Storage's own object metadata. If Storage under-reported size, an oversized file could slip; this is
  the same trust the recording finalize + `/api/files` already place in it, and the bucket's own 25 MB ceiling
  is a second backstop.
- **The customer widget runs on our origin with `NEXT_PUBLIC_SUPABASE_*` inlined.** The anon browser client
  is constructed in the widget; `uploadToSignedUrl` is authorized by the one-object token, not a visitor
  session, so an unauthenticated visitor can still upload. If the widget were ever embedded cross-origin
  without those env vars, `createClient()` would fail — surfaced as the generic upload error, not a silent
  drop.
- **The finalize `storagePath` prefix equals the caller's companyId.** True because `createSignedUploadTarget`
  → `buildStoragePath` mints `"<companyId>/<yyyy>/<mm>/<uuid>.ext"`. The prefix check is what makes the
  admin-client read safe; it relies on that layout, which is shared by every asset path.

## Residual (A36 — ranked by confidence-it-does-not-matter; top must be OPENED)
```json
[
  { "id": "R1", "item": "Any OTHER C.A.R.E / coach upload route still routing a large file through req.formData() (the body-cap class beyond these two).", "why_skipped": "F2 named only these two; a fresh sweep could still miss a sibling.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-11T16:40:00Z", "outcome": "Swept `grep -rl req.formData() src/app/api` filtered to upload/files/care/coach. The only ASSETS-bucket formData routes are: these two (fixed), upload-recording (already ported this session), and /api/files (whose LARGE path already uses the signed /api/files/upload-url flow; its direct multipart is small-file only, a different product surface, not newly broken). The extract routes are intentionally ≤4 MB. No other C.A.R.E/coach conversation upload remains on the cap." },
  { "id": "R2", "item": "The A30 structural gate for the class — a lint/invariant that fails an ASSETS-bucket formData() route lacking a storagePath JSON branch.", "why_skipped": "Per the proposal's A33 analysis, the cap is applied three heterogeneous ways (direct constant / validateUploadCandidate / literal), so a precise detector can't be written without false positives; NAMED-and-declined until the pattern is uniform. Now that these two are ported, the surface is closer to uniform but /api/files' small-file multipart path still legitimately exists, so a naive 'formData writing to assets => must have storagePath branch' would false-flag it. Gate deferred, hole named here + in the proposal.", "confidence_it_does_not_matter": "medium", "opened_at": null },
  { "id": "R3", "item": "Backfill / migration of in-flight uploads: a customer mid-upload during deploy could hit an old client posting multipart to the new route.", "why_skipped": "The multipart branch is KEPT on both routes precisely so an old client (or a non-JS caller) still works — there is nothing to backfill; both entry points are live simultaneously.", "confidence_it_does_not_matter": "low", "opened_at": null }
]
```

## Gate result (`npm run check`)
```
$ npm run check
typecheck ✓ · lint ✓ · theme:audit ✓ · rls:audit ✓
invariant:audit ✓ — Violations: 0 (incl. "every upload route validated" + CWE-209 "no raw error .message to the client")
tbc ✓ — docs · manifest (16 entries) · artifacts · residual (3) · freshness all ✓
test ✓ — Test Files 388 passed | 1 skipped (389); Tests 2677 passed | 15 skipped (2692)
CHECK_EXIT=0
```

The port clears the standing invariant suite (including the upload-validation and CWE-209 gates that directly
cover these two routes) and the full 2677-test suite, with no regression to the 36 pre-existing C.A.R.E
upload tests.

