# BUILD — Meeting Review PDF export

### The shareable PDF document (pure + tested)
- write-path: `src/lib/coach/meeting/meetingReviewPdf.ts` — `buildMeetingReviewHtml(dissect, meta)` returns a
  self-contained, inline-styled, colour document (header band, summary callout, indicator chips, colour-accented
  Decisions / Action items (owner pills, owner-less flagged) / Left open / Agenda sections). All model text
  HTML-escaped; `print-color-adjust:exact` so it prints in colour. `exportMeetingReviewPdf` opens it + prints.
- read-path: the founder clicks Export PDF → a clean, structured, colour PDF they can save + share with the team.

### The button
- write-path: `src/components/sales-coach/MeetingReview.tsx` — an "Export PDF" button (shown when there's content);
  a popup-blocked hint if the window is blocked. Optional `meetingTitle`/`meetingStartedAt` props.
- write-path: `src/app/dashboard/meeting-coach/[id]/review/page.tsx` — resolves the session title + date
  (server-side, RLS) and passes them for the PDF header.
- read-path: the review shows an Export PDF action; the exported header carries the meeting's name + date.

### Completeness (not a bandaid)
- write-path: `src/lib/coach/strategy/meeting/__tests__/generateAndStoreMeetingDissect.test.ts` — DISS-R1
  drift-guard: asserts the meeting dissect runs on `DEEPSEEK_NONREASONING_MODEL` (A30 — can't silently regress).
- read-path: the suite now FAILS if a future refactor drops the non-reasoning model override → a long meeting can't
  silently start returning empty reviews again.
- write-path: `src/lib/care/elostateProductKnowledge.ts` — Jeff now knows Meeting Coach + the shareable PDF.
- read-path: a user asking Jeff about meeting reviews / exporting gets an accurate answer.

## Files
- `src/lib/coach/meeting/meetingReviewPdf.ts` (NEW) + `__tests__/meetingReviewPdf.test.ts` (NEW)
- `src/components/sales-coach/MeetingReview.tsx`, `src/app/dashboard/meeting-coach/[id]/review/page.tsx`
- `src/lib/coach/strategy/meeting/__tests__/generateAndStoreMeetingDissect.test.ts` (drift-guard)
- `src/lib/care/elostateProductKnowledge.ts`
- `scripts/diag-render-meeting-pdf.mts` (visual-verify tool)

## Ripple (§6 item 5)
- Pure builder + a client button; no API/schema change. The export is client-side (no server render cost).
- Untrusted transcript-derived text is escaped (no HTML injection into the print window).
- The product-knowledge addition is additive (its 5 tests still pass); no other Jeff behavior changes.
