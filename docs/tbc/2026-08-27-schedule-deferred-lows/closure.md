# CLOSURE — schedule deferred LOW fixes

## What shipped
The five LOW findings the schedule audit deferred (closure R1), after the founder greenlit them (picker: "deferred
LOWs, start upload cap"): (1) the binary-upload cap — the old 6 MB base64 cap exceeded Vercel's ~4.5 MB request limit,
so a legit multi-week roster file got an opaque platform 413; now single-sourced (`uploadLimits.ts`), pre-flighted
client-side with a clear message, and the route caps corrected. (2) the printed/PNG colour schedule now footers
"⚠ N have no one assigned" instead of looking fully staffed. (3) the re-importable table PDF transliterates non-Latin
names (José→Jose) or shows a visible '?' instead of mangling them. (4) an xlsx column cap stops a crafted far-right
cell from amplifying each row to 16k elements. (5) the expensive events + coverage replay GETs are rate-limited.

## Verification (A38)
`npm run check` → EXIT 0 (see check.md). The pure seams (upload limit, pdfText, xlsx cap) each carry a
failing-without-it test; 591 files / 3865 tests; typecheck + lint clean.

## The un-named reliance
- **Two fixes have no pure unit seam** and are locked by the full gate + reasoning, not a dedicated test: the printed
  footer (canvas rendering, not jsdom-testable — the empty-shift COUNT it reads is already tested), and the two GET
  rate-limits (a one-line limiter identical to 27 sibling routes). Their end-to-end correctness (the footer actually
  prints; the limiter actually 429s a burst) is founder/observation-verify.
- **The 3 MB upload ceiling is a chosen headroom** under the ~4.5 MB platform limit, not a measured maximum. If a real
  roster file legitimately exceeds 3 MB, raise `MAX_UPLOAD_BYTES` (and the base64 cap) together — the test enforces
  they stay consistent with the platform limit.

## Residual (A36 — explicit)
```json
[
  {
    "id": "R1",
    "item": "The PDF name fix transliterates/placeholders rather than embedding a Unicode font — a CJK name shows '?' not the glyph in the re-importable PDF (the colour PNG renders it fine via canvas).",
    "why_skipped": "Embedding a TTF subset is heavyweight for a LOW; a readable-or-visible-placeholder is honest and round-trippable for Latin names, and the visual PNG export already renders full Unicode.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-27T12:34:00+08:00",
    "outcome": "OPENED — bounded; embed a font only if a CJK roster needs the re-importable PDF specifically."
  }
]
```
