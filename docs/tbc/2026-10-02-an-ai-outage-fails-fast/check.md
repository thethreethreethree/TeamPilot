# CHECK - an AI outage fails fast

## Commands

```
$ npx tsc --noEmit -p .
exit 0
$ npx vitest run src/lib/llm src/lib/coach/doorlog src/app/api/coach/sales-session
 Test Files  97 passed (97)
      Tests  803 passed (803)
exit 0
$ (mutation: worker outage branch set to false)  npx vitest run worker.test.ts   Tests  7 failed | 32 passed   exit 1 (restored)
$ (mutation: both assertProviderAvailable calls removed)  npx vitest run providerHealth.test.ts   Tests  3 failed | 10 passed   exit 1 (restored)
```

The full `npm run check` is appended below.

## Findings

### An AI outage longer than 3.5 minutes destroyed every pitch recorded during it

class: an account- or provider-level failure charged to the individual item's retry budget
sweep: grep -n "isTerminalFailure\|attempts" src/lib/coach -r; every worker with a per-item attempt ceiling that calls the AI
severity: high

Quota was fixed this way on 2026-09-25; timeouts and 5xx were not. Now both defer.

### Every AI call waited 45 s during an outage

class: a hung dependency paid in full by every caller
sweep: grep -rn "fetchWithTimeout" src/lib - DeepSeek is the only provider in production
severity: medium

The breaker covers DeepSeek. Anthropic is not wired to it (unused in production). ElevenLabs (speech) is not an AI
call here and is not covered.

## Not opened

No image, icon, logo, favicon or graphic asset was touched.

## Full gate

```
$ MIGRATION_AUDIT_PSQL="docker exec -i pgprobe psql -U postgres" PGHOST=localhost PGPORT=55433 ... npm run check
 Test Files  728 passed | 1 skipped (729)
      Tests  5649 passed | 15 skipped (5664)
exit 0
```

## Appended 2026-10-02T06:40Z - what the rep sees when a cue fails

### "Cue request failed (502)." and "see console" shown to a rep

class: a developer-facing message on a rep-facing surface, made more visible by failing fast
sweep: grep -rn "setCueStatus(" src/lib/coach/v5 (useMeetingCoaching already says "check your connection")
severity: low

```
$ npx tsc --noEmit -p .
exit 0
$ npx vitest run src/lib/coach/v5
 Test Files  93 passed (93)
      Tests  727 passed (727)
exit 0
```

```
$ npm run check   (with the cue message)
 Test Files  729 passed | 1 skipped (730)
      Tests  5673 passed | 15 skipped (5688)
exit 0
```
