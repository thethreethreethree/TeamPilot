# CHECK — Prep-up Phase 1: data model + OCR + routes

## Gate — the canonical command (A38)

```
$ npm run check
 Test Files  556 passed | 1 skipped (557)
      Tests  3654 passed | 15 skipped (3669)
EXIT: 0
```

All gates exit 0. New tables + new routes + new OCR module; no `coaching_sessions` / sales change.

## OCR verified end-to-end (before building on it)
Rendered a text image (headless Chrome) and OCR'd it with Tesseract.js in Node: extracted "MEETING GOAL: Close
the Q3 deal / Topics: pricing, timeline, support" accurately in ~1.2s. DeepSeek vision was tested first and its
API returned `400 "This model does not support image"`, confirming the token-free Tesseract path is required.

## What the tests prove
- Document route: 401/403/404, refuses executables/unsupported types (never mints a target), signs an allowed
  type, refuses a cross-company storagePath, OCRs an image + stores it, and is GRACEFUL (extraction throwing
  still stores the note, upload not blocked).
- Create route: 401/403/200-draft. `[id]`: GET 404-non-owner / 200-with-docs; PATCH updates / 404-not-owner.

## Founder precondition (§1.5.3)
Migration `0238` must be applied via `npm run db:apply` before Prep-up can persist. A34-safe until then: the
feature is not wired into any flow, so nothing existing breaks; the routes simply error if called pre-migration.

## Findings
**No findings.** Foundation is isolated + hardened; the OCR path was proven before building; extraction is
graceful so there's no user-facing complication.
