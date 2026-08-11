# Proposal — port the two C.A.R.E conversation upload routes off the ~4.5 MB Vercel body cap

**Status:** proposed (awaiting founder greenlight). **Trigger phrase:** *"port the CARE uploads"*.
**Origin:** finding **F2** of `docs/audits/2026-08-11-recording-upload-artifact-audit.md` — the class-sweep
(A29) of the Sales-Coach recording-upload fix caught two unswept siblings of the same class.

## The bug (confirmed by reading the routes 2026-08-11)

Both routes receive the file **through the serverless function body** (`await req.formData()`), which Vercel
hard-caps at **~4.5 MB**, then upload it to Storage server-side. So any attachment between ~4.5 MB and the
advertised cap fails at the *platform* layer, before the handler runs — the same silent failure the
recording bug had.

| Route | Advertised cap | Evidence | Who hits it |
|---|---|---|---|
| `src/app/api/care/conversations/[id]/agent-upload/route.ts` | **25 MB** (`AGENT_MAX_BYTES`, comment line 26) | `form = await req.formData()` (line 72); no `application/json` / `storagePath` branch | **agents** attaching images / PDFs / docs to a support conversation |
| `src/app/api/care/conversations/[id]/upload/route.ts` | **10 MB** (`CUSTOMER_MAX_BYTES`) | `form = await req.formData()` (line 60); no signed-URL branch | **customers** attaching a phone photo / PDF in the chat widget |

A 5–10 MB phone photo or a scanned PDF — routine in a support conversation — fails today with a
"Failed to fetch"-class error, invisible to the app's 10/25 MB cap. **Class:** large-file upload routed
through the serverless function body instead of client→storage.

## The fix — mirror the proven signed-URL direct-to-storage pattern

The codebase already has this pattern in **two** places to copy verbatim (A28): `/api/files` (sign =
`/api/files/upload-url`, finalize = `/api/files`) and this session's Sales-Coach recording upload (sign =
`…/upload-recording/sign`, finalize = the JSON branch of `…/upload-recording`). Reusable primitives:
`createSignedUploadTarget`, `getAssetObjectInfo`, `downloadAssetBytes`, client `uploadToSignedUrl`.

Per route:
1. **Sign endpoint** (`…/agent-upload/sign`, `…/upload/sign`) — auth + conversation-access gate + validate
   size/type/extension up front, then `createSignedUploadTarget` → `{ bucket, storagePath, token }`.
   Keep each route's existing allow-list (agent: images/pdf/docs; customer: images/pdf) and cap.
2. **Client** — `CareChatWidget.tsx` (customer), `ConversationsApp.tsx` (agent), and any `FileDropzone`
   caller pointed at these routes: sign → `supabase.storage.from(bucket).uploadToSignedUrl(path, token, file)`
   → POST `{ storagePath }` to finalize. (FileDropzone already does this for `/api/files` — extract/reuse.)
3. **Finalize** (JSON branch on the existing routes) — re-read the REAL object via `getAssetObjectInfo`
   (client size/type untrusted), **verify `storagePath.startsWith(companyId + "/")`** (audit F1's lesson —
   don't hand an admin sink unvalidated caller input), then attach the media to the conversation as today.
4. **Keep the multipart branch** as a small-file fallback (like the recording route), so nothing regresses.

## The gate (A30) — so the class can't silently return

Add an invariant to `scripts/invariant-audit.mjs`: **an upload route that calls `req.formData()` AND whose
cap constant is `> 4.5 MB` MUST also expose a signed-URL / `storagePath` JSON branch** (or be explicitly
allow-listed with a reason). Detection sketch: match route files containing `req.formData()`; if the same
file references `AGENT_MAX_BYTES`/`CUSTOMER_MAX_BYTES`/a numeric `* 1024 * 1024` cap `> 4.5`, require a
`storagePath`/`application/json` branch in the same file. **A33 caveat:** the cap-constant lookup makes a
precise detector non-trivial; if it proves noisy, keep the routes allow-listed-with-reason and rely on this
proposal + the shared primitives rather than ship a gate that false-positives on the deliberately-≤4 MB
text-extract routes (`sales-session/extract`, `coach/extension/extract`, `care/agent/acms/extract`,
`tenant/logo`). Ship a quiet gate or none — not a noisy one.

## Risk + effort

- **Effort:** medium — 2 sign endpoints + 2 finalize branches + ~3 client call-sites + route tests + the
  invariant. All patterns already exist; this is porting, not inventing.
- **Risk of the fix:** it touches **customer-facing** upload (the chat widget) — regressions here are
  visible to a business's customers. Needs the same care as the recording port: keep the multipart fallback,
  test the sign gate (403 cross-company), and confirm the widget's error states.
- **Why it was NOT auto-fixed:** different product (C.A.R.E, not the Sales Coach artifact under audit), a real
  customer-facing refactor, and a live Sales-Coach client test in progress — deploying a customer-upload
  change unprompted mid-test is overtaking. Hence this proposal for greenlight.

## Decision

Greenlight to build (trigger *"port the CARE uploads"*) — recommended, since it's a real customer-facing
failure for any attachment above ~4.5 MB. Sequencing option: customer `upload` route first (widest blast
radius — end customers), then agent `agent-upload`.
