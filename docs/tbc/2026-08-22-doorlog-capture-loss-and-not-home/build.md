# BUILD — Door Log: capture loss never drops the outcome + "Not Home" from the outcome screen

### sendPitch — knock fallback when there's no usable audio
- write-path: `sendPitch(base, blob)` signs + uploads only when a blob exists; if no `storagePath` results
  (null blob OR failed sign/upload), it POSTs `{ kind: "knock", outcome }` — preserving the disposition + KPI —
  and returns `audioDropped: true`. Otherwise it POSTs `{ kind: "pitch", ... , storagePath }`.
- read-path: the disposition surfaces exactly as before — the KPI strip (`door_knocks` view) reflects the
  fallback knock, and `save()`'s amber notice (below) tells the rep the audio was dropped; no pitch → no Report
  Card row, which is correct (there is no audio to review).
- Signature changed from `(body: Record, blob)` to a typed `(base: {outcome,name,durationMs,clientKnockId}, blob)`
  so the fallback can build the correct body for each path. Only caller is `save()`.

### save — honest surface
- write-path: `save()` branches on the `sendPitch` result — `audioDropped` sets the AMBER `notice` state; a real
  `!ok` sets the red `sendError` state; a clean save sets neither.
- read-path: an amber info banner renders for `notice` ("Saved the outcome — but this pitch recorded no audio…")
  and the existing red banner for `sendError`; distinct tones so a saved-but-partial result never reads as failure.

### Not Home / No Answer from the outcome screen
- write-path: `notHome()` POSTs `{ kind: "knock", outcome: "no_answer", localDate, clientKnockId }`, clears
  `recorded`/`noRecord`, and dispatches `NO_ANSWER` (state machine: `outcome --[NO_ANSWER]--> idle`, newly legal).
- read-path: a "Not Home / No Answer" button renders on the OUTCOME screen (secondary "none of the above" style);
  the KPI strip reflects the no-answer knock via the same `door_knocks` view every knock uses.

Also folded in (not a feature, no path): `saveFailMessage` no longer promises "tap to retry" (there is no client
retry queue) — it says re-log the door, matching what the dismiss-only banner actually does.

## Files
- `src/lib/coach/doorlog/stateMachine.ts` — NO_ANSWER legal from `outcome`; header diagram + comment.
- `src/components/sales-coach/doorlog/DoorLog.tsx` — sendPitch knock-fallback + audioDropped; `notice` state +
  amber banner; `notHome` handler + outcome-screen button; honest fail copy.
- `src/lib/coach/doorlog/__tests__/stateMachine.test.ts` — NO_ANSWER-from-outcome + exhaustive legal set.
- `src/components/sales-coach/doorlog/__tests__/DoorLogCaptureLoss.render.test.tsx` — NEW: null-blob save
  preserves the outcome as a knock (no red banner, amber notice); Not-Home logs a no_answer knock.

## Reuse
The knock fallback reuses the exact `{ kind: "knock", outcome }` write the no-mic path (`logOutcomeKnock`)
already uses — same KPI semantics, no new server shape. No sales-scoring / server-route change.
