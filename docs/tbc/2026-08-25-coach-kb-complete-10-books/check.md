# CHECK — complete the Coach v5.0 Knowledge Base to 10/10 books (D6)

## Gate — the canonical command (A38)
```
$ npm run check
  (typecheck → lint → theme:audit → rls:audit → invariant:audit → tbc → test)
  Invariant audit: Violations 0
  tbc:docs ✓  tbc:manifest ✓ (11 entries)  tbc:artifacts ✓  tbc:residual ✓ (R1 opened)  tbc:freshness ✓
  Test Files  577 passed | 1 skipped (578)
       Tests  3782 passed | 15 skipped (3797)
GATE_EXIT=0
```
(The KB integrity guard now passes at the 10-book floor; +2 KB-guard test files vs the pre-D6 baseline.)

## What the tests prove
- `knowledgeBase.test.ts` (floor now 10): the KB loads substantial (not truncated), contains **all 10** book
  sections, EACH carries the operational principle format (Source / a named ### principle / When-applies /
  Canonical-move / Language-pattern / Worked-example with Before/After), and the Refuted section is present. A dropped
  or malformed book fails the test.
- `buildSystemPrompt.test.ts` (unchanged): asserts the KB is still embedded in the assembled Coach prompt —
  confirms the loader picks up the completed file with no wiring change.

## Content source-discipline (recorded, not gate-run)
Deep-research: 25 claims 3-vote source-checked, 0 refuted, sources primary/author (dalecarnegie.com + public-domain
Carnegie; Hachette + Gladwell interview + Levine; Harvard PON + Sheila Heen). Attribution caveats folded into the
do-not-cite notes.

## Findings
No findings — 10/10 books integrated, the completion gate (10-book floor + per-book format) is exercised by
knowledgeBase.test.ts, the loader is unchanged, and the source discipline (§5) is honored (primary/author sources,
0 refuted, caveats recorded).
