# CLOSURE — Door Log: capture loss never drops the outcome + "Not Home"

## What shipped
1. **Capture loss no longer drops the outcome.** No usable audio (null blob / failed upload) → `sendPitch` logs
   the disposition as a knock (KPI + outcome preserved) and shows an honest amber "no audio to review" heads-up,
   instead of omitting `storagePath`, 400-ing the pitch, and losing the sale under a red "didn't save on our end".
2. **"Not Home / No Answer" from the outcome screen.** A stopped recording with nobody at the door logs a
   no-answer knock and discards the recording, instead of forcing a false Sold/Go-Back/Not-Interested.

Full `npm run check` exit 0. No sales-scoring or server-route change — the server was already right (a pitch
requires audio); the client was wrong to send an audio-less one.

## The un-named reliance
- **Device confirmation.** jsdom render tests prove the logic; the real trigger (a phone losing the recorder
  mid-pitch) needs a device: knock → record → lock/background the phone → stop → the outcome saves with the amber
  note, not a red failure. Filed to the founder action queue.

## Residual (A36)

```json
[
  {
    "id": "naming-step-shown-then-discarded-on-null-blob",
    "item": "On a null-blob capture the rep still passes through the NAMING screen before Save; the typed name is then discarded (the fallback is a knock, which has no name).",
    "why_skipped": "The blob is known at Stop, but routing the naming screen off it is extra flow surface; the critical fix (never lose the outcome) does not need it.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-22T04:05:00+08:00",
    "outcome": "Deferred as follow-up polish: on a null blob at Stop, skip NAMING and log the knock directly with an inline 'no audio captured' note."
  },
  {
    "id": "empty-storagePath-worker-kick-pre-existing",
    "item": "A pitch whose upload failed previously reached the server with storagePath='' (passes z.string()), creating a hollow pitch + a worker kick on an empty path.",
    "why_skipped": "The client fix removes the client-side source (no storagePath -> knock, never a hollow pitch). A server guard is defense-in-depth.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-22T04:05:00+08:00",
    "outcome": "Closed at the client layer this build; server hardening noted for a later pass."
  }
]
```

Full narrative in `docs/closures/2026-08-22-doorlog-capture-loss-and-not-home.md`.
