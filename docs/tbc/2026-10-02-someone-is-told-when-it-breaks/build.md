# BUILD - someone is told when it breaks

### Whether error reporting is on can be read from outside

- **write-path:** `src/app/api/health/route.ts` `capabilities.errorReporting`.
- **read-path:** `src/app/api/health/__tests__/route.test.ts` (four combinations); `curl https://elostate.com/api/health`.

### An AI outage is reported once

- **write-path:** `src/lib/llm/providerHealth.ts` `Sentry.captureMessage` on the first opening of a streak.
- **read-path:** `providerHealth.test.ts` "someone is told, once per outage"; the Sentry project once the DSN exists.

### The setup step is on the record

- **write-path:** `docs/CONFIG-PRECONDITIONS-AUDIT.md`, appended section of 2026-10-02.
- **read-path:** the founder, via the closing report; step 3 there is the check.
