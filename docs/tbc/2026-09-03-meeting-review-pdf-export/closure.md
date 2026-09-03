# CLOSURE — Meeting Review PDF export

## What shipped
An "Export PDF" on the Meeting Review that produces a clean, colour-coded, shareable document: a titled/dated
header, a summary, quick-read indicator chips (Focused/Drifted, participation balance, and an owner-less-actions
alarm), then the meeting broken into clear sections — Decisions (numbered), Action items (each with an owner pill;
owner-less flagged in red — the #1 meeting failure), Left open, and Agenda coverage (covered vs missed). The design
was verified by rendering the founder's real review and reading the PDF (the founder specified the experience, so
it is layer-2 — §1.5.4/AMD-012). All model/transcript text is HTML-escaped. Completeness (not a bandaid): added the
DISS-R1 drift-guard test pinning the meeting dissect to the non-reasoning model, and taught Jeff about Meeting
Coach + the shareable PDF.

## Verification (A38)
Headless-render + read (visual proof, pasted in check.md). `npm run typecheck` clean. PDF builder 6 tests; the
meeting suite 54/54 (incl. the drift-guard); Jeff product-knowledge 5/5.

## The un-named reliance
- Relies on the browser's print-to-PDF (Save as PDF) — the standard mobile/desktop export path; a popup blocker is
  handled with an actionable hint, not a silent no-op.
- Relies on the viewer's print dialog honoring background graphics — forced via `print-color-adjust:exact` on all
  elements (the AMD-012 colour lesson) so it prints in colour, not monochrome.

## Residual (A36 — explicit)
```json
[
  {
    "id": "PDF-R1",
    "item": "The export uses window.open + print; on some in-app/embedded browsers a new window may be constrained. A server-rendered PDF (headless render) would be download-link-based and embed-proof, at the cost of a serverless render.",
    "why_skipped": "The client print path matches the app's existing schedule export, needs no server cost, and covers standard browsers; the popup-block hint makes a failure actionable.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-03T10:32:00+08:00",
    "outcome": "OPEN — move to a server-rendered download only if founders report embedded-browser trouble."
  }
]
```
