# BUILD — TBC gate validates the newest build (not the lexicographic-last name)

## Feature inventory
### currentBuildDir() selects by started_at, not by name
- write-path: none (CI gate tooling). N/A.
- read-path: `currentBuildDir()` reads each build dir's think.md `started_at` and returns the most-recently-started
  one via the pure `pickLatestBuildName(entries)`. This replaces `readdirSync().sort()→last`, which silently
  skipped a newer dir whose NAME sorted earlier on the same day. Every downstream verifier (manifest/artifacts/
  residual/freshness) now receives the correct newest dir; the `TBC_BUILD=` override is unchanged. Exercised by the
  live probe (returns display-honesty over forced-client-update) + the 5 `pickLatestBuildName` unit tests.

## Files changed
- scripts/tbc/lib.mjs — currentBuildDir keys on started_at; extract the pure `pickLatestBuildName`.
- scripts/tbc/__tests__/pickLatestBuild.test.ts — 5 tests (the regression + across-days + malformed fallback +
  name-only fallback + empty).

## Holistic (§1.5.1)
Selection-only change; downstream checks unchanged. A malformed dir (no started_at) can't hijack the selection
from a real build. Same-day naming discipline is no longer load-bearing for correctness.
