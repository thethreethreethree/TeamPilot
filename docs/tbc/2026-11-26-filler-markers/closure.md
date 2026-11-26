# CLOSURE - Filler-word markers on the call page

## What is true now

A phone or video call's page lists the rep's filler words (um, uh, erm) with when each was said and a rate per
minute of the rep's own talk; each plays the call from there. The page says the count is from the transcript.

Un-named reliance: speech-to-text keeps fillers today (checked on production); a provider change that strips them
would make the count fall to zero silently.

## Residual

```json
[
  {"id": "R1-stt-strips-fillers", "item": "If the speech-to-text provider starts removing fillers, counts fall to zero without warning.", "why_skipped": "No per-call signal says whether fillers were kept.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-26T09:27:33Z", "outcome": "Recorded."},
  {"id": "R2-team-filler-trend", "item": "No filler rate over time or across the team.", "why_skipped": "This call's page only, as Gong's points of interest.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-26T09:27:33Z", "outcome": "Recorded."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
