# CLOSURE - A company phrase hides a call (stage 1)

## What is true now

A company admin can list phrases in Protection. A phone/video call whose transcript contains one is hidden from everyone
but its rep and company admins: the database refuses the call, its transcript, Highlights, score, notes, follow-up drafts,
follow-through and clips; the library and granted views refuse it too. Someone it's hidden from is told why on the call
page. An admin can unhide a call or retire a phrase; every change is audited and append-only.

## Residual

```json
[
  {"id": "R1-stage2-tables", "item": "Tracker hits, comments, interaction stats and other derived call tables don't yet carry the hide; service-role team aggregates (coaching metrics, team stats) still count hidden calls.", "why_skipped": "The founder chose 'Real hide, in stages'; stage 1 covers the call, its words and its score.", "confidence_it_does_not_matter": "low", "opened_at": "2026-11-25T11:10:00Z", "outcome": "Deferred to stage 2 (ledger F33.8)."},
  {"id": "R2-retired-hides", "item": "A call hidden by a phrase that was later retired stays hidden, but the panel no longer counts it; an admin finds it from the call page.", "why_skipped": "Keeping hides on retire is the safer default; a list of hidden calls is stage 2.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-25T11:10:00Z", "outcome": "Deferred to stage 2."},
  {"id": "R3-backfill-cap", "item": "Adding a phrase checks at most 500 calls from the last 90 days.", "why_skipped": "Bounded background work inside one function run.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-25T11:10:00Z", "outcome": "Accepted."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
