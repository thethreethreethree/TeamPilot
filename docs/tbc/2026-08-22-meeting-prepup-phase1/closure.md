# CLOSURE — Prep-up Phase 1: data model + OCR + routes

## What shipped
The foundation of Prep-up (Team-Sync): the data model (migration 0238 — `meeting_preps` + `meeting_prep_documents`,
company-scoped + owner RLS), a token-free OCR module (`extractImageText` via Tesseract.js — verified end-to-end),
the data layer, and the routes (create draft · read/update goal+topics · sign+confirm document upload with
image-OCR / pdf-text extraction). Reuses the hardened direct-to-storage upload so it behaves identically on the
website + mobile webapp. Extraction is graceful (OCR/extract failure → note-only, upload never blocks). Full
`npm run check` exit 0. No `coaching_sessions`/sales change.

OCR decision proven, not assumed: DeepSeek vision API rejects images (`400`), Anthropic is out → Tesseract.js
(token-free), verified locally before building.

## The un-named reliance
- **Migration 0238 (founder `npm run db:apply`)** — a blocking precondition (§1.5.3). Until applied, Prep-up
  can't persist; but nothing existing depends on it (A34-safe — not wired into any flow yet).
- **Tesseract.js in the Vercel Node serverless runtime** — verified in LOCAL Node; the serverless engine/lang
  load (first-run download) needs a prod confirmation. Bounded by the graceful fallback (OCR fails → note-only),
  so a serverless OCR hiccup never blocks an upload. If prod OCR proves flaky, bundling the traineddata (or
  moving OCR client-side) is the next lever — no data-model change needed.

## Residual (A36)

```json
[
  {
    "id": "tesseract-serverless-prod-unverified",
    "item": "Tesseract.js OCR verified in local Node, not yet in the Vercel serverless runtime (engine + eng.traineddata load on first run).",
    "why_skipped": "Local proof is strong; the graceful fallback means a serverless OCR failure degrades to note-only (no user-facing break). Prod confirmation belongs to the go-live device/prod check.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-22T11:09:00+08:00",
    "outcome": "Isolated + graceful; flagged for the go-live check. Fallback (bundle traineddata / client-side OCR) available if needed."
  },
  {
    "id": "phase1-not-wired-into-flow",
    "item": "Prep-up routes exist but are not yet reachable from the UI or linked to a meeting session (that's Phases 2-5).",
    "why_skipped": "By design — Phase 1 is the foundation; wiring + live-brain + Dissect coverage are the next phases.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-22T11:09:00+08:00",
    "outcome": "Intentional phase boundary; nothing exposed to users until wired (Phase 5)."
  }
]
```
