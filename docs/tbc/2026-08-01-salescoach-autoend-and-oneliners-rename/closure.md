# CLOSURE — Sales Coach auto-end (B) + One Liners rename (C)

## What shipped

- **B:** finishing a recording (upload or live) auto-ends the session, then lands on After-Pitch — so the
  duration + avgSessionDuration KPI populate and the post-call flow is one step. Idempotent + non-blocking.
- **C:** "Strategy" → "One Liners" across the nav item and the page (title + hint labels), route unchanged.
- **A:** confirmed no change — Analytics/Session stay rep-visible per the founder's decision.

## What I relied on that is NOT self-evident (the un-named-reliance half)

- **The 0070 end trigger is the real source of `ended_at`.** The route only sets `status`; the DB trigger
  stamps the timestamp. The whole "auto-end populates duration" claim rests on that trigger firing on the
  active→ended transition — and on its `ended_at is null` guard making re-end safe. If that trigger were ever
  dropped, auto-ending would set status but not duration, silently.
- **`LearningHint category` is context passed to `askJeff`, not a seen-state key.** Renaming the two category
  strings was safe only because of that — it re-shows no dismissed hint. Verified by reading LearningHint
  before relabelling.
- **Client-initiated `fetch` survives `router.push`.** `endThenAfterPitch` awaits the PATCH before navigating,
  so this isn't load-bearing here — but the design assumes the end write completes server-side regardless of
  the client nav that follows.

## Residual (A36)

```json
[
  {
    "id": "RES-01",
    "item": "Auto-end treats EVERY completed recording as end-of-call. A rep who records only a mid-call snippet would have the session ended early (they can continue, but the session reads 'ended').",
    "why_skipped": "The founder explicitly chose 'auto-end on recording complete' over 'leave active' knowing this trade-off; the recording flow is post-call by design (upload = the finished call; live transcript-saved = call wrapped). Distinguishing a snippet from a full call needs a signal that doesn't exist today.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-01T06:00:00Z",
    "outcome": "OPENED + accepted per the founder's decision. If snippet-recording becomes a real workflow, gate the auto-end behind a 'this was the full call' confirm."
  },
  {
    "id": "RES-02",
    "item": "No automated render/interaction test locks the recording-complete → ended → After-Pitch flow (would need a component harness mounting LiveCoachingPanel/SessionRecordingUpload and asserting the PATCH + navigation).",
    "why_skipped": "The change is a one-line handler swap to a shared helper; the end PATCH + trigger idempotency are the load-bearing parts and are covered by the trigger's own guards. A brittle render test for a redirect handler is low-value.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-01T06:00:00Z",
    "outcome": "OPENED. Typecheck + the nav/sales-coach suites pass; the CI gate runs the full suite."
  }
]
```

## Verification

Typecheck exit 0; nav + sales-coach suites 24/24 (see check.md for the pasted command output + exit codes).
Full `npm run check` is the CI gate.
