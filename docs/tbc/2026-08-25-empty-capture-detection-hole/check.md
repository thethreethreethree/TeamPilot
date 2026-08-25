# CHECK — close the empty-capture detection hole

## Gate — the canonical command (A38)
```
$ npm run check
  (typecheck → lint → theme:audit → rls:audit → invariant:audit → tbc → test)
  Invariant audit: Violations 0
  tbc:docs ✓  tbc:manifest ✓ (11 entries)  tbc:artifacts ✓  tbc:residual ✓ (R1 opened)  tbc:freshness ✓
  Test Files  575 passed | 1 skipped (576)
       Tests  3769 passed | 15 skipped (3784)
GATE_EXIT=0
```
(+4 tests vs the prior build — isCaptureViable both branches, chunks-override, capturedBytes-in-diag.)

## What the tests prove
- `isCaptureViable`: durable chunks → viable regardless of blob; a truthy-but-tiny stub (5 bytes / < threshold) with
  no chunks → NOT viable; a blob ≥ MIN_VIABLE_AUDIO_BYTES → viable (a short real recording is not rejected — not a
  length gate).
- `capturedBytes` is carried in the diag (defaults 0; a `sawData:true, capturedBytes:5` stub is representable).
- DoorLog render suite: 12-of-12 files pass with realistic recording mocks — the viability gate doesn't reject a
  real recording, and the no-audio path still fires for a genuinely empty capture.

## Findings
No findings — the gate is grounded in the real telemetry gap, sits in a shared pure helper, and keeps the honest
no-audio path (warn + record) for a non-viable capture. iOS root cause + full latency are out of scope (flagged).
