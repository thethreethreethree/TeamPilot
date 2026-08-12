# CHECK — TBC build-selection fix

## Verification run (A38)
Canonical command: `npm run check`.

## Findings
### F1 — the gate validated the lexicographically-last NAME, silently skipping a newer same-day build
file+line: `scripts/tbc/lib.mjs` — `currentBuildDir()` used `readdirSync().sort()→last`.
class: gate integrity — a verifier selecting the WRONG artifact, so a build could ship with an unvalidated record
(exactly what happened to 2026-08-13-display-honesty this session).
severity: medium (no runtime impact, but the verification gate silently mis-validated — a trust hole in the gate).
sweep-command: `grep -rn "currentBuildDir\|readdirSync(TBC_DIR)" scripts/tbc` — `currentBuildDir` is the SINGLE
build-selection point (all verifiers import it from lib.mjs), so fixing it here corrects every tbc gate at once.
remediation: select by `started_at` via the pure, tested `pickLatestBuildName` (see remediate.md).

## Tests
```
$ npx vitest run scripts/tbc/__tests__/pickLatestBuild.test.ts
 Test Files  1 passed (1)
      Tests  5 passed (5)
```
The exact regression is locked: two same-day dirs where the NEWER one's name sorts EARLIER → the newer wins by
started_at. Plus across-days ordering, the malformed-dir fallback (can't hijack), name-only fallback, and empty.
Live probe: `currentBuildDir()` now returns `2026-08-13-display-honesty` (10:00), not `forced-client-update` (09:30).

## Full gate
```
PENDING — pasted in closure after the run
```
