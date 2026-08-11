# Proposal — port the two C.A.R.E conversation upload routes off the ~4.5 MB Vercel body cap

**Status:** ✅ SHIPPED 2026-08-11 (founder-greenlit). Build: `docs/tbc/2026-08-11-xf-care-upload-body-cap-port`.
**Trigger phrase:** *"port the CARE uploads"*.
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

Intended invariant: **an upload route that calls `req.formData()` AND whose effective cap is `> 4.5 MB` MUST
also expose a signed-URL / `storagePath` JSON branch** (or be explicitly allow-listed with a reason).

**A33 — VERIFIED infeasible as a standalone grep (2026-08-11), so the gate is DECLINED at this altitude, not
merely cautioned.** I checked the actual detection surface before proposing the gate:
- The two CARE routes do **not** reference `AGENT_MAX_BYTES`/`CUSTOMER_MAX_BYTES` by name — their cap comes
  from `validateUploadCandidate(uploadedVia)`, which resolves the constant *internally*. So a detector keyed
  on the constant NAMES **misses the very routes this is about**.
- The deliberately-≤4 MB text-extract routes (`sales-session/extract`, `coach/extension/extract`,
  `care/agent/acms/extract`) use a `4 * 1024` literal + `MAX_EXTRACT`, a THIRD cap mechanism.
- So the cap is applied three heterogeneous ways (direct constant / `validateUploadCandidate` / literal); a
  grep that catches the CARE routes (via `validateUploadCandidate` + `formData` + no-branch) risks
  false-positives on any small `validateUploadCandidate` route, and one that keys on the constant names is
  incomplete. Per A33, a gate that resists precise detection is NAMED-AND-DECLINED, not shipped noisy.

**The gate the port SHOULD ship instead (structural, not grep):** once these routes are ported, the natural
key is *uniform* — a route that does `req.formData()` to write to the ASSETS bucket without also handling a
`storagePath` finalize branch. Add the invariant THEN, when the pattern is uniform and the 2 routes are fixed
(no grandfather needed), rather than shipping a grandfathered detector against a heterogeneous surface now.
Until then the hole is named here + the proposal is the record.

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
