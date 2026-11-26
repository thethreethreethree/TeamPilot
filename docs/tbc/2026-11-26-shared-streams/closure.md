# CLOSURE - Shared saved searches (company streams)

## What is true now

A manager can share one of their saved searches with the company. Everyone sees it under Saved searches with who
shared it and can follow it; each person's new-call count uses their own access, so sharing a filter never shows
anyone a call they couldn't open. Unsharing or removing it takes it away.

Un-named reliance: a shared search's filter may name a rep or a tracker; a follower who can't see that rep simply gets
no matches.

## Residual

```json
[
  {"id": "R1-email-streams", "item": "Streams still alert in the app only (no email/Slack).", "why_skipped": "Email isn't configured in production.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-26T09:40:49Z", "outcome": "Recorded."},
  {"id": "R2-shared-cap", "item": "At most 50 shared searches are listed per person.", "why_skipped": "Bounded read; companies have far fewer today (0 saved searches shared).", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-26T09:40:49Z", "outcome": "Accepted."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
