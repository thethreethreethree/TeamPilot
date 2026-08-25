# CHECK — empty/unplayable recording → honest "No audio captured"

## Gate — the canonical command (A38)

```
$ npm run check
  (typecheck → lint → theme:audit → rls:audit → invariant:audit → tbc → test)
  Invariant audit: Violations 0
  tbc:docs ✓  tbc:manifest ✓ (11 entries)  tbc:artifacts ✓  tbc:residual ✓ (R1 opened)  tbc:freshness ✓
  Test Files  575 passed | 1 skipped (576)
       Tests  3765 passed | 15 skipped (3780)
GATE_EXIT=0
```
(+1 test vs the prior build — the headerless-stub → honest-terminal case.)

## What the tests prove
- A NON-empty but HEADERLESS recording (the observed 5-byte webm Cues stub) → terminal "No audio captured (empty or
  unplayable)", `transcribeSpeech` NEVER called, never analyzed. The honest cause, not a relayed "corrupted".
- The existing STT-path tests still reach STT (default mock now carries a valid EBML header) — the guard doesn't
  short-circuit a legitimate recording.
- The b5cdb61d recovery tests still pass (their buffers start with EBML → pass the guard → reach STT → recovery),
  proving the guard and the recovery operate on disjoint inputs.

## Findings
No findings — the guard is grounded in the real bytes, sits at the STT chokepoint, and makes the failure honest
without touching a valid recording. Recovery-of-the-audio and the client capture cause are out of scope (flagged).
