# CLOSURE - Upload a call by API

## What is true now

A company admin can make a key that also uploads calls. An outside tool posts a recording to /api/v1/calls for one of the
company's reps; the call is created, stored, transcribed and ended, and the rep is told. On the call page the rep confirms
the customer knew it was recorded and picks their voice; that scores it, like any upload.

## Residual

```json
[
  {"id": "R1-live-upload", "item": "Not yet run end to end with a real recording and a real key.", "why_skipped": "Needs a key made in the app and a real call file.", "confidence_it_does_not_matter": "low", "opened_at": "2026-11-27T01:11:00Z", "outcome": "Recorded in OPEN.md."},
  {"id": "R2-long-files", "item": "Transcription runs inside the request (up to 300 s); a very long recording may time out, leaving it stored and retryable from the call page.", "why_skipped": "The app's upload has the same bound.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-27T01:11:00Z", "outcome": "Recorded."}
]
```

## Un-named reliance

attribute-unlabelled stays owner-only and keeps scoring the call after the answer.

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
