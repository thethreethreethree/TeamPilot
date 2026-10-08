# BUILD - a failed read is not an unscored pitch

### A failed read throws a named error

- **write-path:** `src/lib/coach/pitchScore/readPitchScore.ts` `PitchScoreReadError` (main read and the four follow-up reads).
- **read-path:** `src/lib/coach/pitchScore/__tests__/readPitchScore.test.ts` "a failed read is not an unscored pitch".

### Both routes answer 500 on it

- **write-path:** `pitch-score/route.ts` GET; `pitch-score/override/route.ts`.
- **read-path:** their `__tests__/route.test.ts` (GET: 500 and no `pitch` key; override: 500 and nothing written).
