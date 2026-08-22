# BUILD — Prep-up Phase 2: the UI

### MeetingPrepUp component
- write-path: creates a draft prep on mount (POST /meeting-prep); goal + topics autosave via debounced
  PATCH /meeting-prep/[id]; document upload runs POST /[id]/document `sign` → `uploadToSignedUrl` → `confirm`.
  Images show a note step before upload (founder spec); text/pdf upload immediately.
- read-path: renders the goal textarea, the numbered must-discuss topic list (add/remove), and the uploaded
  documents (filename + kind + note + extracted preview); a "Saved" tick on autosave; honest upload-error text.

### page
- write-path: n/a (client page).
- read-path: `/dashboard/meeting-coach/prep` renders `MeetingPrepUp`; "Start Meeting" → the live coach with the
  prepId in the query (Phase 5 consumes it).

## Files
- `src/components/sales-coach/meeting/MeetingPrepUp.tsx` (new).
- `src/app/dashboard/meeting-coach/prep/page.tsx` (new).
- `src/components/sales-coach/meeting/__tests__/MeetingPrepUp.render.test.tsx` (new — 3 tests).

## Reuse
Reuses the Phase-1 routes verbatim (no new server contract), the `uploadToSignedUrl` client pattern (same as the
Door Log / recording upload), theme tokens + the mobile-first field styling. No sales/meeting-session change.
