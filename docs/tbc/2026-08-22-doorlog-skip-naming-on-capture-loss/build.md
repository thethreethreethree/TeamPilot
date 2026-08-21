# BUILD — Door Log: skip naming when capture produced no audio

### pickOutcome — capture-loss skips naming
- write-path: `pickOutcome(outcome)` — no-mic → `logKnockOutcome(outcome)`; recorded-flow with `!recorded?.blob`
  → `logKnockOutcome(outcome, { audioDropped: true })`; else → naming (`PICK_OUTCOME`) as before.
- read-path: on a no-audio pick, the rep goes straight to IDLE with the amber "no audio to review" note and no
  "Name this pitch" screen; a normal recorded pick still reaches naming → Save.

### logKnockOutcome — one consolidated knock tail
- write-path: `logKnockOutcome(outcome, opts?)` POSTs `{ kind: "knock", outcome }`, optionally sets the amber
  `notice` when `opts.audioDropped`, bumps KPI optimistically, resets `recorded`/`noRecord`, returns to IDLE.
- read-path: replaces the former `logOutcomeKnock`; the no-mic path calls it with no flag (no note), the
  capture-loss path with `audioDropped: true` (honest note). The `save()` upload-failure fallback is unchanged.

## Files
- `src/components/sales-coach/doorlog/DoorLog.tsx` — `logKnockOutcome` helper (replaces `logOutcomeKnock`);
  `pickOutcome` capture-loss branch.
- `src/components/sales-coach/doorlog/__tests__/DoorLogCaptureLoss.render.test.tsx` — updated: a no-audio pick
  logs the knock directly and asserts naming is SKIPPED (`Name this pitch` absent) + flows home.

## Reuse
Three near-identical "log an outcome as a knock, go home" paths collapse to one helper. No server, state-machine,
or sales change; `save()`'s late upload-failure fallback stays for the path it still owns.
