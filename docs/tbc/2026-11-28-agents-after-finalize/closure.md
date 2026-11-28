# CLOSURE - agents after finalize

## What is true now

Finishing a call answers the rep without waiting on any agent; call-added agents run right after.

## Residual

```json
[
  {"id": "R1-after-budget", "item": "after() runs within the route's own time limit; a slow playbook read could still be cut off there.", "why_skipped": "The claim is at most once (a cut-off run is a missed read, never a doubled one), and finalize's limit covers the engines it already waits on.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-28T05:15:00Z", "outcome": "Recorded."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
