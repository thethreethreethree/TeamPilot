# CLOSURE - keep voices apart

## What is true now (in the repo; 0270 not applied, website and app not shipped)

A recorded-audio read keeps which voice said each line, and a call with two unassigned voices is answered by naming
the rep's voice, on the web and in the app, as a new version.

## Residual

```json
[
  {
    "id": "R1-0270-not-applied",
    "item": "0270 is not applied; the website reads speaker_cluster through the view and must not deploy before it.",
    "why_skipped": "A production migration needs the founder's go-ahead.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-10-08T13:45:00Z",
    "outcome": "OPEN."
  },
  {
    "id": "R2-two-calls-have-no-voices",
    "item": "cef6995b and 8bde1ce2 were saved before 0270 with no voice ids; they need one more re-read to be asked per voice.",
    "why_skipped": "Needs 0270 live and two speech-to-text runs.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-10-08T13:45:00Z",
    "outcome": "OPEN."
  },
  {
    "id": "R3-card-render-untested",
    "item": "The web two-voice card has no render test: it is a non-exported component in a Next page file.",
    "why_skipped": "Its decision is the tested transcriptVoices and the route is tested; extracting the component is a refactor of its own.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-10-08T13:45:00Z",
    "outcome": "OPEN."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
