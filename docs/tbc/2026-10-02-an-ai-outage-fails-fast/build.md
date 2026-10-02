# BUILD - an AI outage fails fast

### One outage verdict

- **write-path:** `src/lib/llm/errors.ts` `isProviderOutage`.
- **read-path:** `providerHealth.ts` (counts it) and `worker.ts` (defers on it); `providerHealth.test.ts` pins that
  the breaker's own skip error is an outage.

### The DeepSeek provider stops calling during an outage

- **write-path:** `src/lib/llm/providerHealth.ts`; `deepseek.ts` `call()` and `stream()` check it first and record
  each call's outcome.
- **read-path:** `providerHealth.test.ts`: after two hung calls the third rejects with no request made, for calls
  and streams.

### A pitch waits out an outage instead of failing

- **write-path:** `worker.ts` outage branch, `OUTAGE_RETRY_MS`, `OUTAGE_GRACE_MS`, `withinOutageGrace`;
  `claimPitchesToProcess` selects `created_at`; the door-log route passes it.
- **read-path:** `worker.test.ts` "an AI provider outage never kills a recent pitch": thirty sweeps never terminal;
  older than 24 h or no creation time spends the attempt.

### A rep's failed cue says what happened (appended 2026-10-02T06:40Z)

- **write-path:** `src/lib/coach/v5/cueFailureMessage.ts`; `useLiveCoaching.ts` uses it for an HTTP failure (the
  route's own sentence) and a network failure.
- **read-path:** `src/lib/coach/v5/__tests__/cueFailureMessage.test.ts`.
