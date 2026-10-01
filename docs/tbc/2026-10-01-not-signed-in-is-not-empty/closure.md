# CLOSURE - not signed in is not empty

## What is true now

Every route the app calls refuses a caller who is not signed in; the one that answered "no review" now says
"not authenticated", which the app already turns into a sign-in explanation.

## Residual

```json
[
  {
    "id": "R1-widen-the-smoke",
    "item": "The smoke covers the 44 route references the app makes, not every route under src/app/api.",
    "why_skipped": "This was Phase 0's baseline for the app's dependencies; a whole-API smoke is its own build.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-10-01T15:10:00Z",
    "outcome": "OPEN."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.

## Appended 2026-10-01 — seen live

After ad92fc88 deployed (CI success, Vercel Ready), production: `GET` and `POST`
/api/coach/sales-session/<id>/after-pitch with no login both answer **401** (were 200 and 404).
