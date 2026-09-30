# CHECK — a failed save says why, and stops paying

## How it was found

The 09-29 build's remediate.md recorded this as a **promise**, not a gate. The founder's folder showed "Score them
all" at pass 7 reporting "10 could not be saved", while production logged 164 identical foreign-key refusals
(2026-09-26..28). Every one of those came after a paid grading.

## Commands

```
$ npx tsc --noEmit -p .
exit 0

$ npx vitest run src/lib/coach/pitchScore src/app/api/coach/sales-session/pitch-score \
    src/components/sales-coach/__tests__/UnscoredBacklog.render.test.tsx
 Test Files  25 passed (25)
      Tests  439 passed (439)
exit 0

$ (five mutations, each applied, its tests run, and the original restored)
M1 errored label back to "failed unexpectedly for"      -> 1 failed | 13 passed
M2 STORE_FAILED_HALT = 99 (no halt)                     -> 1 failed | 20 passed
M3 STORE_FAILED_HALT = 1 (halt on a single one)         -> 2 failed | 19 passed
M4 no_evidence merged back into store_failed            -> 1 failed | 11 passed
M5 a success no longer resets the run                   -> 1 failed | 20 passed
(each mutation exits 1, and the restored tree exits 0)

$ npm run check        (first run, before check.md and closure.md existed)
typecheck, lint, theme/rls/invariant/reachability/writer/enum/migration audits, sql:harness: all passed
tbc:artifacts: 2 failures, check.md and closure.md missing
CHECK_EXIT=1
```

The full `npm run check` after this file was written is appended below.

## Findings

### Two causes of a failed save shared one bare null

class: a failure return that merges causes with different remedies (one about this item, one about the system)
sweep: grep -rn "Promise<string | null>" src/lib/coach — then, for each hit, ask whether null means more than one thing
severity: medium

`storePitchScore` returned `null` both when the scorer honoured no grade and when the database refused the write.
So nothing downstream could stop a drain on the systemic cause without also stopping it on the per-recording one.

### A drain kept paying to grade what it could not save

class: a paid loop with no stop on a systemic post-payment failure
sweep: grep -n "haltedBy" src/app/api/coach/sales-session/pitch-score/backfill/route.ts; grep -rn "for (const .* of batch)" src/app/api
severity: high

164 gradings were bought and discarded on 09-26..28. It now halts at 2 in a row.

### Refusal labels dangled on a preposition

class: a UI string map keyed by an open string type, so the compiler cannot see a missing or malformed key
sweep: grep -rn "Record<string, string> = {" src/components
severity: low

The panel printed "194 failed unexpectedly for" for the whole out-of-credit outage.

## Not verified

- No drain has run against production since 0268 (pitch_scores = 0, read-only query at 2026-09-30T02:22Z;
  367 unscored sales sessions across 4 companies; the cron logged only silent 200s in the last 20 minutes).
- The halt has not been observed live, and cannot be without a real systemic failure.

## Not opened

No image, icon, logo, favicon or graphic asset was touched. The onboarding PDF (5 pages) was opened and read
page by page for the adjacent guide findings, which are reported to the founder and are not part of this change.

## Appended — the full gate, after this file existed

```
$ npm run check
all 12 steps, including tbc (docs, manifest, artifacts, residual, freshness)
 Test Files  720 passed | 1 skipped (721)
      Tests  5575 passed | 15 skipped (5590)
CHECK_EXIT=0
```
