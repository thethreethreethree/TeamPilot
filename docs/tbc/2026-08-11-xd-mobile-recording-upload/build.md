# BUILD — Mobile recording / voice-memo upload

Three features. Each asserts how bytes get IN (write-path) and how they come back OUT (read-path),
per §3.2 / A31 (the DB↔surface seam is where a "working" system silently becomes a nonexistent one).

### Direct-to-storage recording upload (bypasses the 4.5 MB serverless cap)
The architecture fix. The browser uploads bytes straight to Supabase Storage, so the file never passes
through the Vercel function body (the ~4.5 MB ceiling that killed every real recording).

- **write-path:** client `POST /api/coach/sales-session/[id]/upload-recording/sign` with
  `{filename, sizeBytes, mimeType}` → server (auth + company + `getSession` access + **owner-or-manager**
  per INV19) validates size ≤ `AGENT_MAX_BYTES` (25 MB), `audio/`|`video/` MIME, non-executable ext →
  `createSignedUploadTarget` returns `{bucket, storagePath, token}`. Client
  `supabase.storage.from(bucket).uploadToSignedUrl(storagePath, token, file)` writes the bytes DIRECT to
  Storage. Client then `POST /api/coach/sales-session/[id]/upload-recording` with JSON `{storagePath, mimeType}`
  → server reads the REAL object via `getAssetObjectInfo` (untrusted client size rejected: > 25 MB → 413;
  non-audio/video → 400), stamps `coaching_sessions.audio_asset_url = <bucket>/<storagePath>` (admin write
  scoped `.eq("id")`+`.eq("company_id")`), downloads bytes + `transcribeWithDiarization`, returns
  `{segments, speakers}`. The labeled transcript is appended by the existing `/label-transcript` (unchanged).
- **read-path:** `getSession(id)` returns `audioAssetUrl`; `GET /api/coach/sales-session/[id]` returns
  `transcript` (the labeled segments) which the session page + After-Pitch render; the multipart branch of
  `upload-recording` is retained as a guarded fallback so existing callers/tests keep their read contract.

### Upload reachable on every session AND after it (Standard live + After-Pitch)
Reverses the Standard p4/p5 removal per the founder's explicit pick. Expert already had it on every session.

- **write-path:** `SessionRecordingUpload` now renders in Standard on the live-session page
  (`[id]/page.tsx`, previously wrapped in `{!isStandard && …}`) and on the After-Pitch page
  (`after-pitch/page.tsx`, both modes) — all feeding the SAME upload write-path above. On After-Pitch,
  `onLabeled` calls the summary rebuild so the newly-appended transcript is turned into the review.
- **read-path:** the component's visibility is driven by `session.status` + `session.audioAssetUrl` from
  `GET /api/coach/sales-session/[id]`; after labeling, the After-Pitch summary is re-read/re-generated from
  the transcript (the rep lands on a populated review, not a dead end — L3).

### Voice-memo format acceptance (Android + Apple)
Apple Voice Memos export `.m4a`; Android recorders produce `.m4a`/`.amr`/`.3gp`/`.ogg`/`.wav`.

- **write-path:** the file input `accept` is broadened to
  `audio/*,video/*,.m4a,.mp3,.wav,.aac,.amr,.3gp,.3gpp,.ogg,.oga,.caf,.mp4,.webm` so extension-only mobile
  pickers surface the memo; the sign + finalize routes accept any `audio/`|`video/` MIME, and an empty MIME
  (common when a memo is picked from Files) defaults to `audio/webm` → passes the gate. Bytes then follow
  the direct-to-storage write-path above.
- **read-path:** an accepted memo transcribes via ElevenLabs Scribe → segments → the identical read-path as
  the first feature (transcript on the session page + After-Pitch). Formats Scribe can't decode surface the
  honest "No speech was transcribed from that recording" rather than a silent empty.

## Files touched
- NEW `src/app/api/coach/sales-session/[id]/upload-recording/sign/route.ts` — the signed-target minter.
- `src/app/api/coach/sales-session/[id]/upload-recording/route.ts` — add JSON finalize-from-storage branch +
  owner-or-manager gate; keep the multipart branch as a guarded fallback.
- `src/components/sales-coach/SessionRecordingUpload.tsx` — client switched to direct-to-storage; `accept`
  broadened; copy → "voice memo or call recording."
- `src/app/dashboard/sales-coach/[id]/page.tsx` — render the upload for Standard too (keep coach-tools + raw
  transcript Expert-only).
- `src/app/dashboard/sales-coach/[id]/after-pitch/page.tsx` — render the upload (both modes) + `onLabeled`
  rebuild + empty-state copy pointing at the in-place upload.
- NEW `src/app/api/coach/sales-session/[id]/upload-recording/sign/__tests__/route.test.ts` — auth /
  validation / owner-gate.
- `src/app/api/coach/sales-session/[id]/upload-recording/__tests__/route.test.ts` — add finalize-branch cases.
