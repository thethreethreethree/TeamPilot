# 07 — Meeting-review "Export PDF" (iOS-safe)

**What it is.** The Meeting Coach's post-meeting review has an **Export PDF** that produces a **real, downloadable
`.pdf`** — a colored, designed document (header band, summary card, indicator chips, agenda with status dots,
decisions, action items with owners) — not a print dialog. The web fix made it dependency-free and **iOS-safe**.

**Why this matters for the app.** The web's original bug is an iOS bug: on iOS Safari, `window.open` with
`noopener` NULLs the handle, and an **async `print()` loses the user-activation**, so the export opened blank or
falsely claimed "pop-ups blocked." The web now (a) builds the PDF **bytes directly** (no print dialog) and offers
them via a download, and (b) added an **in-document "Save as PDF" button** as the iOS manual path. A native app
sidesteps the browser entirely — use the **native share/print sheet** — but the content + the "generate real
bytes, don't rely on a print dialog" principle carry over.

## Web source of truth
- Byte builder (dependency-free): `src/lib/schedule/writePdf.ts` — `assemblePdf`, `strBytes`, `concat`,
  `pdfText`. Raw PDF content stream: `BT/ET`, `/F1 <size> Tf`, text matrix `Tm`, `(text) Tj`, fill color
  `r g b rg`, filled rect `x y w h re f`. Helvetica / Helvetica-Bold. `pdfText` transliterates to Latin-1 (so use
  colored **dots** for ✓/✗ and a middle dot `·`, not em-dashes — non-Latin-1 glyphs become `?`).
- Meeting doc: `src/lib/coach/meeting/meetingReviewPdf.ts` — `buildMeetingReviewPdf(dissect, meta): Uint8Array`
  (portrait A4 595×842, header band, summary card, indicator chips, agenda with green/red status dots, decisions,
  action items with owner / red "No owner" pills, text-wrapped, paginated). `exportMeetingReviewPdf` turns the
  bytes into a Blob download.
- iOS manual path (web): an in-document "Save as PDF" button, because iOS async `print()` loses activation.

## App work (native)
1. Fetch the meeting **dissect** (the same review data the web renders) for the meeting.
2. Generate a PDF natively — `expo-print` (HTML → PDF) or a native PDF builder — laying out the SAME sections:
   header (meeting title + date), a summary line, indicator chips, the agenda with per-item **green/red status
   dots**, decisions, and action items each with an **owner** (owner-less flagged in red).
3. Present it via the **native share sheet / "Save to Files"** — the reliable iOS path (no browser print dialog).
4. Copy rules: no em/en dashes in the generated copy; use a middle dot `·` and colored dots for status.

## States
- Generating (spinner); shared/saved; error → a clear retry. Never a blank document — if the data isn't ready,
  say so rather than exporting an empty PDF.
