# BUILD — Prep-up Phase 1: data model + OCR + routes

### migration 0238 (data model)
- write-path: new tables `meeting_preps` (goal, topics jsonb `{id,text,covered}`, status, session_id) +
  `meeting_prep_documents` (storage_path, kind, note, extracted_text); company_id tenancy; owner RLS
  (created_by = auth.uid()); touch_updated_at trigger.
- read-path: the live cue path finds a session's agenda via `meeting_preps.session_id` (no coaching_sessions
  change). ⚠ FOUNDER applies via `npm run db:apply` (never hand-applied).

### extractImageText (token-free OCR)
- write-path: `extractImageText(bytes)` dynamically imports Tesseract.js, OCRs eng, timeout 25s, cap 20k chars.
- read-path: returns the extracted text, or "" on any failure (graceful — caller stores the note alone).

### meetingPrep.ts (data layer)
- write-path: `createMeetingPrep` / `updateMeetingPrep` / `addPrepDocument` / `markMeetingPrepStarted` /
  `setMeetingPrepTopicsCovered` (owner ops via the request client → RLS; brain-side `getMeetingPrepBySession`
  via admin).
- read-path: `getMeetingPrep` / `listPrepDocuments` (owner-scoped); INV22 (null on real error).

### routes
- write-path: `POST /meeting-prep` (create draft) · `PATCH /meeting-prep/[id]` (goal+topics) ·
  `POST /meeting-prep/[id]/document` — `sign` (allowlist-gated → signed upload target) then `confirm` (download
  → OCR image / extractText pdf-text → store). `maxDuration = 120` for OCR + extract.
- read-path: `GET /meeting-prep/[id]` returns the prep + its documents.

## Files
- `supabase/migrations/0238_meeting_prep_up.sql` (new tables + RLS).
- `src/lib/documents/extractImageText.ts` (new — Tesseract OCR).
- `src/lib/data/meetingPrep.ts` (new — data layer).
- `src/app/api/coach/meeting-prep/route.ts`, `.../[id]/route.ts`, `.../[id]/document/route.ts` (new) + 3 test files.
- `package.json` — `tesseract.js` dependency.

## Reuse
Reuses `createSignedUploadTarget` + `downloadAssetBytes` (the direct-to-storage upload that dodges the ~4.5 MB
body cap — same on web + mobile), the installed `extractText` (unpdf/jszip), `readBody`+zod, `rateLimit`, and the
existing RLS/`auth_company_id()` conventions. No `coaching_sessions` / sales change.
