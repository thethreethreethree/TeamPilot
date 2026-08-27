# CHECK — coaching stitch content-type fix

## Gate — the canonical command (A38)
```
$ npm run check     # tsc --noEmit && eslint && theme:audit && rls:audit && invariant:audit && tbc && test
> typecheck / lint / theme:audit / rls:audit / invariant:audit — pass
> tbc:docs / tbc:manifest / tbc:artifacts / tbc:residual / tbc:freshness — pass
> test            Test Files  588 passed | 1 skipped (589)
                  Tests  3847 passed | 15 skipped (3862)
GATE_EXIT=0
```
(One intermittent flaky failure was seen on an earlier run and did NOT reproduce across two subsequent clean runs;
it is unrelated to this deterministic label change — noted in closure as an un-named reliance to watch.)

## What this covers
- The coaching stitch now labels the stitched recording with the chunk's real container (iOS `audio/mp4`), not a
  hardcoded `audio/webm` — so `downloadAssetBytes` reads the true type and the dissect/worker hand STT a parseable
  file. Mirrors the already-fixed DoorLog twin.
- Two gate tests lock it (mp4 preserved; webm default untouched). The mock models + captures the contentType.

## Findings
No findings — a narrow, twin-mirroring content-type fix on the durability (stitch) path, gated on both twins.
