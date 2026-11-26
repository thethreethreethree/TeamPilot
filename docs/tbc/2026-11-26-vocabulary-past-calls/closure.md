# CLOSURE - Fix past calls with the vocabulary's corrections

## What is true now

A company admin can check how many of the last 180 days' calls the "heard as" corrections would change (and that each
fixed call's AI notes are redone, one AI pass per call), then fix them 50 at a time. Each fixed call gets a new
transcript version; the old one stays as history; a call changed in the meantime is skipped and picked up next time.

Un-named reliance: the scan covers the newest 500 finished calls of the last 180 days; older calls stay as they are.

## Residual

```json
[
  {"id": "R1-older-calls", "item": "Calls older than 180 days, or beyond the newest 500, aren't scanned.", "why_skipped": "Bounded scan per click; the count says when it's capped.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-26T12:44:48Z", "outcome": "Recorded."},
  {"id": "R2-in-person", "item": "Door (in-person) pitches aren't fixed.", "why_skipped": "The vocabulary is a Remote Sales setting; in-person pitches have their own scoring flow.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-26T12:44:48Z", "outcome": "Recorded."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
