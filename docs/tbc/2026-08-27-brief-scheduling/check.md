# CHECK — Brief scheduling

## Gate — the canonical command (A38)
```
$ npm run check
  (typecheck → lint → theme:audit → rls:audit → invariant:audit → tbc → test)
  Invariant audit: Violations 0  (cron registered + CRON_SECRET-gated + maxDuration confirmed)
  tbc: docs + manifest (12) + artifacts + residual + freshness all ✓
  Test Files  583 passed | 1 skipped (584)
       Tests  3824 passed | 15 skipped (3839)
GATE_EXIT=0
```
(+2 labelForDays tests.)

## What the tests prove
- labelForDays: a 1-day window is "the last day" (never "the last 1 days"); multi-day is "the last N days".
- Existing parseTeamBrief honesty tests + the F1 prompt-carries-names guard still pass (the engine's seams unchanged).

## Precondition (§1.5.3) + invariant audit
The cron is CRON_SECRET-gated (constantTimeEqual), registered in vercel.json, and exports maxDuration — satisfying the
invariant-audit rules (every cron CRON_SECRET-gated + registered; every LLM route exports maxDuration). Fails LOUD (503)
if CRON_SECRET is unset; runs on the same secret the sibling coach crons already use.

## Not unit-tested (bounded honestly)
storeTeamBrief / getLatestTeamBrief / runTeamBriefPregeneration are integration-shaped (admin DB); the cache write
mirrors the proven event-insert pattern, getLatestTeamBrief null-guards a bad payload, and the pre-generation caches
only an ok brief. The panel toggle + load-on-mount are presentation over the tested engine.

## Findings
No findings — append-only cache (§3.1), a gated + registered cron (§1.5.3 loud-fail), honest states preserved, the
day/week label test-locked.
