# Proposal — two INTERNAL upload surfaces still on the ~4.5 MB Vercel body cap

**Status:** proposed (awaiting founder greenlight). **Trigger phrase:** *"port the internal uploads"*.
**Origin:** the §1.5.2 proactive class-sweep run right after shipping F2 (the two C.A.R.E conversation
uploads). F2 fixed the customer-facing routes; this sweep checked every OTHER caller of the same upload
machinery and found two internal surfaces still exposed.

## The finding (confirmed by reading the callers 2026-08-11)

The body-cap class is: a file routed **through** the serverless function body (`req.formData()`) fails at
Vercel's ~4.5 MB platform limit, before the handler's own cap runs. After F2, the full map of upload surfaces:

| Surface | Caller | Path | Exposed? |
|---|---|---|---|
| C.A.R.E customer widget | `CareChatWidget` | signed (F2) | ✅ fixed |
| C.A.R.E agent composer | `ConversationsApp` → `FileDropzone signEndpoint` | signed (F2) | ✅ fixed |
| Files library | `files/page.tsx` `onFilesSelected` | `/api/files/upload-url` + `uploadToSignedUrl` | ✅ already signed |
| **Task assets** | `TaskAssetsSection.tsx:124` | `fetch("/api/files", { body: form })` — multipart | ⚠️ **on the cap** |
| **Topic chat** | `chats/[id]/page.tsx:1474` `FileDropzone` (default) | multipart → `/api/files` | ⚠️ **on the cap** |

So a team member attaching a >4.5 MB file — a scan, a screen recording, a photo — to a **task** or a **topic
chat** hits the same silent "Failed to fetch" the customer widget had, invisible to the app's 25 MB cap.

**Class:** large single-file upload routed through the serverless function body instead of client→storage.
**Severity:** MEDIUM (internal users, not customers; but a real silent failure on routine large files).

## Why it's NOT already fixed by F2
F2 scoped the two C.A.R.E routes the founder named. The `/api/files` route ALREADY has a signed JSON branch
(`storagePath` + F1 prefix check + traversal guard, `route.ts:110-158`) — the library uses it — but the two
callers above still POST multipart. The fix is wiring, not new infrastructure.

## The gotcha that makes it more than a one-liner (read the field names)
`FileDropzone`'s new signed-finalize branch POSTs `{ storagePath, filename, linked_* }`. But `/api/files`'
JSON branch reads **`originalFilename`** (not `filename`) — `route.ts:135-138`. So simply adding
`signEndpoint="/api/files/upload-url"` to the chat dropzone would upload the bytes correctly but record the
title as the literal `"file"` (the route's fallback). The port must FIRST align the field contract — either
have `FileDropzone` send `originalFilename` (and `sizeBytes`, `mimeType`) for the `/api/files` finalize, or
have `/api/files` also accept `filename`. This is exactly the "test the consumer + target, not just the
mapping" class — the signed prop was validated against the C.A.R.E route, not `/api/files`.

## The fix (per surface)
1. **Align the field contract:** make `FileDropzone`'s signed finalize send `originalFilename`, `mimeType`,
   `sizeBytes` (what `/api/files` reads) in addition to / instead of `filename`. The C.A.R.E routes read
   `filename`, so keep both keys or make the C.A.R.E finalize also read `originalFilename` — pick one name and
   converge (a shared contract, not two).
2. **Topic chat:** add `signEndpoint="/api/files/upload-url"` to the `chats/[id]/page.tsx` dropzone.
3. **Task assets:** `TaskAssetsSection` uploads with its OWN multipart `fetch("/api/files")` (not via
   `FileDropzone.upload()`) because it does classify-before-upload. Port its handler to sign → uploadToSignedUrl
   → finalize, mirroring the library page's `handleUpload` (which already does this at `files/page.tsx:151`).
4. **Tests:** a finalize-path test per surface + confirm the classify-before-upload flow still passes the
   department/task/tags through the signed finalize.

## The gate (A30)
Same A33-declined structural gate as F2's residual R2: a precise "formData-to-assets route without a signed
branch" detector still can't be written cleanly because `/api/files` legitimately keeps a small-file multipart
branch. Once these two callers are ported, the natural CLIENT-side invariant becomes uniform — every
`FileDropzone` that can receive a large file passes `signEndpoint` — which is a testable lint on the callers,
not the routes. Add it then.

## Risk + effort
- **Effort:** small-medium — 1 field-contract alignment + 2 caller changes + ~3 tests. All infra exists.
- **Risk:** touches the shared `FileDropzone` finalize contract (the field-name change ripples to the C.A.R.E
  routes shipped in F2) and the task classify-before-upload flow — needs the C.A.R.E finalize tests to stay
  green after the field rename.

## Decision
Greenlight to build (trigger *"port the internal uploads"*) — recommended, since it closes the last two
instances of a class we've now fixed everywhere else, and leaves the upload machinery uniform (every large-file
path is client→storage). Lower urgency than F2 (internal, not customer-facing), so it can also wait.
