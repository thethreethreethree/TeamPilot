# CHECK — Pitch worker: terminalise a crash/timeout loop (audit H2)

## Gate — the canonical command (A38)

```
$ npm run check
 Test Files  558 passed | 1 skipped (559)
      Tests  3671 passed | 15 skipped (3686)
EXIT: 0
```

(Count re-confirmed with the exact number below; worker suite 10 passed — was 8, +2.)

## What the tests prove
- **Poison terminal (new branch):** a claim returning `attempts: 6` (`> MAX_PITCH_ATTEMPTS`) → the pitch is set
  `failed` with "a timeout or crash prevented completion", and NO paid work runs (`transcribeSpeech` /
  `analyzePitch` never called). This is the crash-loop escape the bug lacked.
- **No double-increment (new branch):** a thrown error when the claim returns `attempts: 5` → terminal message
  names **5**, not 6 — proving the catch consumes the lease-set count and does not re-increment.
- **Regression:** the existing F4 skip-transcribe, H1 empty-audio honesty, lease-loser-spends-nothing, and
  completion-rollup tests all still pass under the new `{ won, attempts }` claim shape.

## Honest limit
The real crash path (a genuine serverless timeout/OOM) can't be reproduced in a unit test — it's simulated by a
claim that returns a past-ceiling `attempts`, which is exactly the persisted state such a crash leaves behind.
The atomicity of the lease-increment is the same Postgres row-lock the existing double-spend guard already relies
on (unchanged mechanism, one extra column in the update).

## Findings
**No findings.** No schema change, no migration, single caller updated, ordinary throw path byte-unchanged.
Class swept (A26): the sibling session workers already carry the `auto-close-stale-cron` backstop; the pitch
worker was the outlier, now fixed at the mechanism.
