# CLOSURE - Acting on the review of shared streams and brief templates

## What is true now

A call's Briefs show only answers for its current transcript — after a trim or correction the old answers aren't shown
and the call can be briefed again. A cut-off reply is a failure the person can retry, never "not discussed". Coverage
gives a tracker a share only from 4 calls it listens to. Saving to "objections" finds "Objections". A move refused for
an archived folder of the same name says so.

Un-named reliance: an older run is still stored (append-only) and erasure still reaches it.

## Residual

```json
[
  {"id": "R1-concurrent-path-adds", "item": "Two people saving into the same new folder path at the same moment can still each create it.", "why_skipped": "The lookup and the insert are separate requests; closing it needs a database function for find-or-create.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-26T10:17:48Z", "outcome": "Recorded."},
  {"id": "R2-retired-template-answers", "item": "Answers from a retired template can't be viewed (the picker lists live templates only).", "why_skipped": "They stay stored and erasable; a 'past briefs' list is its own screen.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-26T10:17:48Z", "outcome": "Recorded."},
  {"id": "R3-reshare-old-follows", "item": "Unsharing then re-sharing a search brings back followers' old follows.", "why_skipped": "Their new-call count is capped at 50 and counts only calls they can open.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-26T10:17:48Z", "outcome": "Accepted."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
