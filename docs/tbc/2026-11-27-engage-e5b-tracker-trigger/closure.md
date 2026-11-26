# CLOSURE - Engage E5b: the tracker trigger

## What is true now

An agent can run when a tracker (keyword or smart) is heard for the first time on one of a deal's calls, on that deal,
with the same actions and the same run-as rule. A rescan or a new transcript version never fires it twice. A failure in
an agent never fails the tracker scan.

## Residual

```json
[
  {"id": "R1-trigger-latency", "item": "Tracker-triggered agents run inside the tracker scan, after the call's notes, so a brief action adds to that background time.", "why_skipped": "The scan already runs after the reply; a separate queue would be a new piece of infrastructure.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-26T21:54:00Z", "outcome": "Recorded."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
