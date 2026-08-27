# CHECK — seq-0 header-chunk-loss fix

## Gate — the canonical command (A38)
```
$ npm run check     # tsc --noEmit && eslint && theme:audit && rls:audit && invariant:audit && tbc && test
> typecheck (tsc --noEmit)        — clean
> lint (eslint)                   — clean
> theme:audit / rls:audit / invariant:audit — pass
> tbc:docs        · 2 governing document(s) match the manifest.        ✓
> tbc:manifest    · build: docs/tbc/2026-08-27-seq0-audio-loss · 11 manifest entr(ies)  ✓
> tbc:artifacts   · build: docs/tbc/2026-08-27-seq0-audio-loss        ✓
> tbc:residual / tbc:freshness    — pass
> test            Test Files  587 passed | 1 skipped (588)
                  Tests  3841 passed | 15 skipped (3856)
GATE_EXIT=0
```

## What this covers
- The stitch path now requires the HEADER chunk (seq 0) reached storage, not merely that some chunk did. When seq 0
  is lost but later chunks upload, the client falls back to the header-bearing local blob instead of a doomed stitch
  that would terminalize as "no audio recorded".
- Recorder gate tests (2): `seq0Uploaded` is TRUE on a successful seq-0 upload, FALSE when seq-0 upload fails even
  though a later chunk uploads.
- Two DoorLog render tests updated to return `seq0Uploaded: true` (a fully-successful stream includes the header) —
  they still prove the stitch path runs and never falls to the single-blob sign.

## Findings
No findings — a narrow routing fix on a confirmed MEDIUM audit item, with the seq-0 distinction locked by tests.
Outcome integrity was never at risk (the knock/outcome always saved); this recovers the AUDIO in the seq-0-loss case.
