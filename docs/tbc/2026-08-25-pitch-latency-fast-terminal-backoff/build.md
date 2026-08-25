# BUILD — cut after-pitch latency: fast-terminal permanent failures + shorter retry backoff

### permanent-failure classifier (retry cannot fix → terminalise now)
- write-path: `retryBackoff.ts` — new pure `isPermanentFailure(message)`: bad audio content (400 invalid_audio /
  invalid_content / "file is corrupted") OR missing config ("no brain row" / "company … not found"). Conservative:
  5xx/timeout/network → NOT permanent.
- read-path: the worker's catch consults it — a permanent error writes terminal `failed` with `Processing failed:
  <message>` (no "after N attempts") on the FIRST occurrence, and never enters the backoff loop.

### shorter transient backoff
- write-path: `retryBackoff.ts` — `DEFAULT_BASE_MS` 30_000 → 7_000. `worker.ts` unchanged (already calls
  `backoffMs(attempts)`); the schedule is now 14,28,56,112s.
- read-path: a genuinely transient failure retries in seconds (≈3.5min cumulative across 5 attempts) instead of
  ~15min; MAX_PITCH_ATTEMPTS stays 5, the 1h cap is untouched (never reached at base 7s × 5 attempts).

## Files
- `src/lib/coach/doorlog/retryBackoff.ts` — base 30s→7s; `isPermanentFailure`.
- `src/lib/coach/doorlog/worker.ts` — catch terminalises immediately on a permanent failure; Sentry tag `permanent`.
- tests: `retryBackoff.test.ts` (new backoff schedule + isPermanentFailure permanent/transient branches);
  `worker.test.ts` (+2: permanent error → terminal-now-no-backoff; transient error → still backs off).

## A26 boundary (class swept)
Class = "a failure that cannot self-heal but is retried on the transient backoff path." The pitch `worker.ts` catch
is the sole retry-driver; `isPermanentFailure` is the one verdict it consults. Empty/no-speech already fast-terminal
via explicit guards (4c208231 / earlier). No other worker runs this loop.

## Ripple (holistic — §6 item 5)
- Pure classifier + one constant + one catch branch; no schema/route/API/migration/config change.
- The base change affects TRANSIENT retries only (permanent errors no longer reach the backoff). Happy path (~30s
  first-try success) is unchanged. Existing retryBackoff schedule test updated for the new base.

## Honest limit
Kills the retry-churn tail (the dominant cause of the inflated average). Does NOT fix the hours-long cron-gap
outliers (needs Vercel cron logs, flagged) or the iOS capture root (device-gated).
