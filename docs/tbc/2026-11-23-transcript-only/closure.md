# CLOSURE - Keep transcripts only

## What is true now

A company admin can choose "Keep transcripts only" in Settings → Protection. A confirmation first says what it means:
every call is still recorded so it can be transcribed; from the next nightly clean-up, a call's audio is removed once
its transcript is ready and the call is a day old, including calls already there; transcripts, scores and coaching
stay; after that there is no playback, no audio clips and no re-transcribing for those calls; saved recordings are
kept. A call is never stripped of its audio unless its transcript is confirmed to exist and the call has ended. Going
back to the standard 90 days or a "last N" count ends it. Each change is in the audit log. The database change is
applied; no company has turned it on yet.

## Residual

```json
[
  {"id": "R1-not-never-recorded", "item": "Audio still exists for about a day per call; nothing records without audio.", "why_skipped": "Our transcription runs on the audio; a provider-side transcript-only path would be its own build.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-23T08:25:00Z", "outcome": "Stated on screen."},
  {"id": "R2-per-call-check", "item": "The cron checks transcripts one call at a time (F2).", "why_skipped": "Bounded and small at today's volume.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-23T08:25:00Z", "outcome": "Opened: OPEN.md."},
  {"id": "R3-first-run", "item": "No company has the mode on, so the first real removal has not happened on production.", "why_skipped": "Off by default by design.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-23T08:25:00Z", "outcome": "Opened: OPEN.md — check the cron response the first night a company turns it on."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
