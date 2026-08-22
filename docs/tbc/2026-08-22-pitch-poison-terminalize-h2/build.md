# BUILD — Pitch worker: terminalise a crash/timeout loop (audit H2)

### the counter now advances at LEASE time, not only in the catch
- write-path: `claimPitchForProcessing(pitchId, currentAttempts)` bumps `run_after` (the lease) AND sets
  `attempts = currentAttempts + 1` in the **same** atomic conditional update, returning `{ won, attempts }`.
  Because a win means the row was still due at lease time, `currentAttempts` (read in the candidate sweep moments
  earlier) is the row's live value, so `+1` is correct. Every attempt — throw, success, or serverless crash —
  now consumes an attempt.
- read-path: `processPitch` reads the returned `attempts`. If `attempts > MAX_PITCH_ATTEMPTS` (5) → a prior
  run hard-crashed without hitting the catch → terminal `failed` ("a timeout or crash prevented completion") +
  Sentry, spending nothing. The `catch` uses the lease-set `attempts` unchanged (no re-increment): `>= MAX` →
  terminal with the message; else back off (move `run_after` only, leave `attempts` as the lease set it).

Boundary: `> MAX` for the pre-work poison gate vs `>= MAX` in the catch keeps the ordinary throw path identical
(5 real tries, failed on the 5th). The 6th claim is reachable ONLY when a crash skipped the catch.

## Files
- `src/lib/data/doorlog.ts` — `claimPitchForProcessing` now takes `currentAttempts`, increments in the lease,
  returns `{ won, attempts }`.
- `src/lib/coach/doorlog/worker.ts` — consume `{ won, attempts }`; poison-pitch pre-work backstop; catch no longer
  re-increments; import `MAX_PITCH_ATTEMPTS`.
- `src/lib/coach/doorlog/__tests__/worker.test.ts` — mock updated to the new return shape; +2 tests (poison
  terminal; no-double-increment throw at the ceiling).

## Ripple (holistic — §1.5)
- Only caller of `claimPitchForProcessing` is `processPitch` (grepped). The route's fire-and-forget kick passes a
  fresh `PitchRow{ attempts: 0 }` → claim sets 1 → identical to before on the first try.
- No schema change: `attempts` already exists and is already written by `setPitchStatus`. No migration, no
  founder db:apply. Deployable now.
- The transient-backoff `setPitchStatus` no longer passes `attempts` (undefined → supabase omits the key → the
  column keeps the lease's value). `backoffMs(attempts)` uses the same value as before.
