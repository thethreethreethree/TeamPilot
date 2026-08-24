# CHECK — bad-concat recovery: salvage the first segment when STT rejects a two-init file

## Gate — the canonical command (A38)

```
$ npm run check
  (typecheck → lint → theme:audit → rls:audit → invariant:audit → tbc → test)
  Invariant audit: Violations 0
  tbc:docs ✓  tbc:manifest ✓ (13 entries)  tbc:artifacts ✓  tbc:residual ✓  tbc:freshness ✓
  Test Files  575 passed | 1 skipped (576)
       Tests  3764 passed | 15 skipped (3779)
GATE_EXIT=0
```
(+4 tests vs the prior build's 3760 — truncate-helper webm/mp4-concat, truncate-helper clean-file-null, worker
retry-and-recover, worker no-retry-without-second-init.)

## What the tests prove
- **`truncateAtSecondInitSegment`**: a webm+webm and an mp4+mp4 concatenation each return exactly the first
  segment (cut at the second init offset), and the head is still a valid recording start; a clean single recording
  returns null — so a good file is NEVER truncated.
- **worker recovery branch**: a two-init file that STT rejects → STT is called a SECOND time with the shorter
  salvaged head, the recovered text is persisted, and the pitch is NOT marked failed; a single-recording
  corruption (no second init) → STT is called ONCE (no wasted retry) and no transcript is written.
- **placement invariant**: the "no wasted retry" test is the guard that the recovery never fires except on a real
  bad-concat fingerprint — the property that keeps a good recording safe.

## Findings
No findings — the recovery is additive on the failure path, safe by placement, and corrects a real gap (existing
bad concats had no recovery). The terminal-pitch re-queue is surfaced to the founder as a cost decision (closure R1).
