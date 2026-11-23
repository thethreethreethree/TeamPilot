# CLOSURE - Correct who said a transcript line

## What is true now

In a call's transcript, the line editor has "Said by the customer" (or "…the rep"): one click moves the line to the
other speaker as a new transcript version (the original stays on record), talk stats and keyword hits follow at once,
and the AI notes are flagged as older so the refresh is offered. Same people as word corrections; audit-logged.
Migration 0328 is applied.

## Residual

```json
[
  {"id": "R1-times", "item": "A corrected line keeps its times (re-timing needs audio alignment).", "why_skipped": "Stays as recorded in OPEN.md.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-23T22:50:00Z", "outcome": "Stays open in OPEN.md."},
  {"id": "R2-mark", "item": "The 'edited' mark shows changed words only; a speaker change has no inline mark (it is in the audit log and the version history).", "why_skipped": "The speaker label itself shows the new value.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-23T22:50:00Z", "outcome": "Accepted; recorded here."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
