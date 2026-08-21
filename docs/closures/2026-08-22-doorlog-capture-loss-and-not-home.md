# CLOSURE — Door Log: capture loss never drops the outcome + "Not Home" from the outcome screen

## What shipped
Two founder-urgent field fixes on Macro Mode's Door Log.

1. **Capture loss no longer drops the outcome.** When audio capture yields no usable blob (the recorder seams:
   mid-call recreation, mobile lock, zero chunks) or the upload fails, the client used to omit `storagePath`,
   the server's `PitchBody` required it, the POST 400'd, and the WHOLE pitch — the sale, the outcome, the door —
   was lost with a red "didn't save on our end" (whose "tap to retry" was a lie). Now `sendPitch` logs the
   DISPOSITION as a knock (KPI + outcome preserved), returns `audioDropped`, and shows an honest amber heads-up
   instead of a red failure. A pitch is never sent audio-less; the sale is never lost to a capture hiccup.

2. **"Not Home / No Answer" from the outcome screen.** A rep who started recording expecting contact — and
   nobody came out — was forced to tag a false Sold/Go-Back/Not-Interested at Stop. Now a "Not Home / No Answer"
   action logs a no-answer knock and discards the recording, straight home. `NO_ANSWER` is a legal
   `outcome → idle` transition, so the flow stays a pure state machine.

Full `npm run check` exit 0. No sales-scoring or server-route change (the server contract was already correct —
a pitch requires audio; the client was wrong to send an audio-less one).

## The un-named reliance
- **Device confirmation.** The capture-loss path and the Not-Home button are proven in jsdom render tests, but
  the real trigger (a phone that actually loses the recorder mid-pitch) can only be confirmed on a device. The
  founder-facing verification: knock, record, lock/background the phone, stop → the outcome saves with the amber
  "no audio" note, not a red failure. Filed in the founder action queue.
- The KPI view counts `sold`/`go_backs`/`not_interested` from `door_knocks` (so a knock-fallback disposition
  shows in the strip) — the same reliance the existing no-mic path already has.

## Residual (A36)

```json
[
  {
    "id": "naming-step-shown-then-discarded-on-null-blob",
    "item": "On a null-blob capture the rep still passes through the NAMING screen before Save; the typed name is then discarded (the fallback is a knock, which has no name).",
    "why_skipped": "The blob is known at Stop, but routing the naming screen off it is extra flow surface; the critical fix (never lose the outcome) does not need it. Naming an unnamed pitch is harmless friction, not a lost record.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-22T04:05:00+08:00",
    "outcome": "Deferred as a follow-up polish: on a null blob at Stop, skip NAMING and log the knock directly with an inline 'no audio captured' note. Not blocking the trust fix."
  },
  {
    "id": "empty-storagePath-worker-kick-pre-existing",
    "item": "A pitch whose upload failed previously reached the server with storagePath='' (passes z.string()), creating a hollow pitch + a worker kick on an empty path.",
    "why_skipped": "The client fix removes the client-side source (no storagePath -> knock, never a hollow pitch). A server-side guard (reject empty storagePath, or skip the worker) is defense-in-depth, not required now.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-22T04:05:00+08:00",
    "outcome": "Closed at the client layer this build; server hardening noted for a later pass."
  }
]
```
