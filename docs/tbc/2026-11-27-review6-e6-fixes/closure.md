# CLOSURE - Review 6 fixes

## What is true now

An outside tool uploads a call of any size up to 100 MB: POST /api/v1/calls (JSON) returns a signed upload named after the
call; it PUTs the file, then POSTs finalize, which checks the stored file and transcribes it. Small files can still go as
multipart. A key makes at most 200 calls a day. A call made by API can't be answered (or scored) until its rep confirms
consent — on the server, not only the screen. The one-voice card shows the voice's first line. The team target shows on
the whole-team view only, is set for one's own team only, and a zero target shows no percentage.

## Residual

```json
[
  {"id": "R1-unfinalized", "item": "A call made by JSON but never finalized is an empty call until the auto-close job ends it.", "why_skipped": "The call must exist to name its file; the reply says to finalize.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-27T02:07:00Z", "outcome": "Recorded."},
  {"id": "R2-idempotency", "item": "A retried POST makes a second call (no idempotency key).", "why_skipped": "Counted by the daily cap; an integrator can add one later.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-27T02:07:00Z", "outcome": "Recorded."},
  {"id": "R3-bell", "item": "The bell keeps 'pick your voice' and later shows 'ready' and 'scored'.", "why_skipped": "Each is true when sent.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-27T02:07:00Z", "outcome": "Recorded."}
]
```

## Un-named reliance

The bucket allows 250 MB (0241); recordingMaxBytes stays the one size rule.

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
