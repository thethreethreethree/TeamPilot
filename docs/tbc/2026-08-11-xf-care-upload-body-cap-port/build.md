# BUILD — C.A.R.E upload body-cap port (F2)

Each feature below names its write-path (how bytes/records get created) and read-path (how the result is
read back / surfaced), per A31 — the DB↔surface seam is where a "done" feature silently becomes a
nonexistent one.

### Customer sign endpoint (`upload/sign/route.ts`)
New public endpoint minting a signed upload target for the widget.
- write-path: `POST` with `x-care-session` token → `getCareConversationByToken` (conv match + not closed) →
  `validateUploadCandidate(claimed size/type/filename, customer_widget)` → `createSignedUploadTarget({companyId: conv.companyId})`
  → returns `{ bucket, storagePath, token }`. On mint failure: logs raw cause, returns generic message (CWE-209).
- read-path: the client reads `{ bucket, storagePath, token }` and calls
  `supabase.storage.from(bucket).uploadToSignedUrl(storagePath, token, file)` — bytes go straight to Storage,
  never through this function.

### Customer finalize branch (`upload/route.ts` JSON branch)
Attaches the object the browser already uploaded.
- write-path: `POST application/json { storagePath, filename }` → prefix check `storagePath.startsWith(conv.companyId + "/")`
  (403 else) → `getAssetObjectInfo` (404 if absent) → `validateUploadCandidate(REAL size/type)` (400 if disallowed)
  → shared `attachCustomerFile` → `createFileRecord` + `postCustomerMessage(kind:attachment)` + `emitAssetEvent`.
- read-path: returns `{ file: row }`; the attachment-kind `support_messages` row renders inline in the thread
  (the agent sees it), and the file appears in the library filter — same surfaces as the pre-existing
  multipart path (unchanged). The multipart branch is kept as the small-file fallback and now shares the same
  `attachCustomerFile` tail.

### Customer client (`CareChatWidget.tsx` → `CustomerUploadButton`)
- write-path: `handleFiles` now does sign → `uploadToSignedUrl` → finalize (`{ storagePath, filename }`), with a
  synchronous `uploadingRef` latch (recording-upload F7 lesson) so a double-pick can't double-upload.
- read-path: on success calls `onUploaded()` (re-fetches the thread) exactly as before; errors surface in the
  button's existing `err` state/title.

### Agent sign endpoint (`agent-upload/sign/route.ts`)
New endpoint minting a signed target for the agent composer.
- write-path: `POST` → `requireCareAgent` (is_support_agent OR admin) → `fetchAgentConversation` (company match)
  → `validateUploadCandidate(claimed, agent_dashboard)` → `createSignedUploadTarget({companyId: auth.companyId})`
  → `{ bucket, storagePath, token }`. Auth mirrors the multipart route exactly (no weaker gate at sign).
- read-path: client reads the target + `uploadToSignedUrl`.

### Agent finalize branch (`agent-upload/route.ts` JSON branch)
- write-path: `POST application/json { storagePath, filename, is_internal_note? }` → prefix check
  `storagePath.startsWith(auth.companyId + "/")` (403 else) → `getAssetObjectInfo` (404) →
  `validateUploadCandidate(REAL size/type)` (400) → shared `attachAgentFile` → `autoRouteFile` →
  `createFileRecord` → `classifyFile` (+ suggestion row) → `postAgentMessage(kind:attachment)` → `emitAssetEvent`.
- read-path: returns `{ file: row }`; the attachment message posts to the conversation (502 honestly if the
  post fails, `§3.4`). Multipart branch kept + shares the same `attachAgentFile` tail.

### Shared FileDropzone signed mode (`FileDropzone.tsx`, opt-in `signEndpoint`)
- write-path: when `signEndpoint` is set, `upload()` does sign → `uploadToSignedUrl` → finalize (JSON
  `{ storagePath, filename, linked_* }` to `endpoint`); when omitted, the pre-existing multipart POST is
  unchanged. Deps array updated. The C.A.R.E agent composer (`ConversationsApp.tsx`) passes both `endpoint`
  (finalize) and `signEndpoint`.
- read-path: unchanged — `onUploadComplete({ ok, file })` fires for both modes; the 4 other dropzone callers
  never pass `signEndpoint`, so their read-path is byte-for-byte the same.
