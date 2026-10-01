# BUILD - a pitch is not six hours long

### The scorer uses the shared duration rule

- **write-path:** `sessionDurationS` in `scoreSession.ts` calls `conversationDurationSeconds(audio, started,
  ended)` and rounds; the copy's own subtraction is gone.
- **read-path:** pitch-score `route.test.ts` "stores no duration for an auto-closed session, never its hours of
  idle wall-clock" (audio null, ended 5 h 20 min after start → null); the three existing duration tests still
  pass (412 s audio; 450 s wall clock; never ended → null).

### No new copy can appear

- **write-path:** `scripts/invariant-audit.mjs` INVARIANT 31: an ended-minus-started subtraction anywhere in
  src outside `conversationDuration.ts` is a violation.
- **read-path:** `npm run invariant:audit` exit 0 on the tree; with the old scorer restored it reports
  `src/lib/coach/pitchScore/scoreSession.ts:290`.
