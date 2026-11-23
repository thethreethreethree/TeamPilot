# CLOSURE - Legal erasure reaches reps' day plans

## What is true now

Erasing a customer now also finds the reps' day plans that mention them (by phone number in any common format, email,
or the client name as entered) and lists them for the admin by rep and day — never the plan's words, which stay the
rep's own. On erase, only the customer's details inside each confirmed plan are replaced with "[removed]"; the rest of
the rep's plan stays. A customer who appears only in plans can be erased too. Migration 0322 is applied to production;
production has no day plans yet, so none has been erased live.

## Residual

```json
[
  {"id": "R1-short-name", "item": "A plan that names the customer differently from the search (\"Betty\" when the client name is \"Betty Ross\") is not found.", "why_skipped": "Matching a first name alone would hit other customers with that name in reps' plans; the admin can search again by the shorter name.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-23T21:25:00Z", "outcome": "Opened: OPEN.md."},
  {"id": "R2-unlinked-prospect", "item": "A pipeline prospect's name/organization is erased only through a linked call (0316); a prospect never linked to a call is not found by erasure.", "why_skipped": "Separate table and its own matching; found during this sweep.", "confidence_it_does_not_matter": "low", "opened_at": "2026-11-23T21:25:00Z", "outcome": "Opened: OPEN.md."},
  {"id": "R3-paren", "item": "A phone written \"(555) 010-0123\" keeps its opening bracket: \"([removed]\".", "why_skipped": "Cosmetic; the number itself is gone.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-23T21:25:00Z", "outcome": "Accepted; recorded here."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
