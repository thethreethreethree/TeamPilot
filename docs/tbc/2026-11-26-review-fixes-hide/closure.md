# CLOSURE - Fixes from the 26 Nov review

## What is true now

Hiding by phrase holds at any size: long calls, many hides, and dispute notes. Followed searches count calls that ended
since you last looked and say when a count couldn't be finished. Switching team on Coaching never shows the previous
team's inbox.

## Residual

```json
[
  {"id": "R1-coverage-links", "item": "Coverage and team-stats links to Search round the period start down to midnight and don't carry the chosen team, so a share's link can open a few more calls.", "why_skipped": "Search has no team filter; the date input takes whole days.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-25T22:30:00Z", "outcome": "Accepted."},
  {"id": "R2-transcript-after-end", "item": "A word-filtered follow can still miss a call whose transcript lands after the person looked but whose call had already ended before.", "why_skipped": "No 'transcript ready' time is filterable in Search.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-25T22:30:00Z", "outcome": "Accepted."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
