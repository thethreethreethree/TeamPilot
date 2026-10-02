# BUILD - an outage is not an attempt

### The provider being unavailable is one verdict

- **write-path:** `src/lib/llm/errors.ts` `isProviderUnavailable`.
- **read-path:** `src/lib/coach/v5/salesDissect.ts` catch; `runAndStoreDissect.emit.test.ts` (four kinds, real LlmError).

### An outage writes no backoff marker

- **write-path:** `salesDissect.ts` shape `provider_unavailable`, and the branch in `runAndStoreDissect` that stores nothing.
- **read-path:** `dissectBackfill.ts` sees no marker and re-selects the session on its next pass; the tests assert
  zero inserts, and that a request-level error and a plain exception still write `threw`.

### The button says what happened

- **write-path:** `src/components/sales-coach/SessionCoachTools.tsx` `emptyDissectMessage`.
- **read-path:** `emptyDissectMessage.test.ts`: "unavailable right now", "recording is saved", "try again in a few minutes".

### Scoring names an AI outage instead of "failed unexpectedly", and a drain stops on it

- **write-path:** `src/lib/coach/pitchScore/scoreSession.ts` refusal `provider_down` (on `isProviderOutage`) with its
  sentence; `pitch-score/route.ts` 503; `pitch-score/backfill/route.ts` halts on it; `UnscoredBacklog.tsx` label.
- **read-path:** `scoreSession.test.ts` "an AI provider that is not answering" (timeout, 503, unreachable);
  backfill `route.test.ts` "stops the run and says so".
