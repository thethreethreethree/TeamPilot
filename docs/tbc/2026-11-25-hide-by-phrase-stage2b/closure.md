# CLOSURE - Service-role lists stop naming hidden calls (stage 2b)

## What is true now

A manager no longer sees a hidden call in the coaching inbox, uncoached lists, coaching counts, the session list, the
dispute queue, calibration or saved coach chats, and can't comment on, share, correct or score it. Vendor staff never see
hidden calls. Feedback requests about a hidden call now leave the manager's inbox (this supersedes the stage-2a note that
they stay visible: the link would lead to a call they can't open).

## Residual

```json
[
  {"id": "R1-aggregates", "item": "Team usage (call count, talk time), rep skill scores, rating and the company cue count still include hidden calls; nothing names the call.", "why_skipped": "Numbers without words or a link; the founder's 'real hide' is about the call and its content.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-25T11:30:00Z", "outcome": "Accepted; ledger F33.8 notes it."},
  {"id": "R2-tracker-backfill", "item": "A manager's tracker scan/backfill still counts and writes hits for hidden calls (the hits are then hidden on read).", "why_skipped": "Counts only; the rows themselves are RLS-hidden (0339).", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-25T11:30:00Z", "outcome": "Accepted."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
