# CHECK — wire the knowledge-corpus budget (INV22 re-starvation gap)

## Gate — the canonical command (A38)

```
$ npm run check
  (typecheck → lint → theme:audit → rls:audit → invariant:audit → tbc → test)
  Invariant audit: Violations 0
  tbc: docs + manifest + artifacts + residual + freshness all ✓
  Test Files  573 passed | 1 skipped (574)
       Tests  3749 passed | 15 skipped (3764)
EXIT: 0
```
(+2 test files, +14 tests vs the prior build's 571/3735 — the corpusBudget unit, the injection-chokepoint
wiring suite, and the two save-route truncation cases.)

## What the tests prove
- **`corpusBudget.test.ts` (NEW, 6):** capCorpus passes under-budget content untouched; treats exactly-at-budget
  as not truncated; truncates over-budget to ≤ budget dropping the tail; hard-cuts when no clean boundary; is
  idempotent; and the budget stays > built-in KBs yet < a starving size. This is the mechanism the whole fix rests on.
- **`corpusCap.wiring.test.ts` (NEW, 6):** each of the 4 LLM-injection chokepoints (methodologyBlock,
  reviewProductBlock, buildPrepSystemPrompt, buildQASystemPrompt) DROPS an over-budget corpus's tail while keeping
  its wrapper, and leaves a normal corpus verbatim. These fail the instant any chokepoint stops capping (A30 gate).
- **corpus + product route tests (+1 each):** an over-budget SAVE stores ≤ budget content and reports
  `truncated`/`originalChars` — the primary defense + the §3.4 honest-warning contract. Pre-existing manager-gating
  and kind tests remain intact.

## A26 boundary (honest completeness)
Fixed: the 2 shared prompt chokepoints (7 consumers), the 2 prep builders, the 2 save routes. Excluded with reason:
liveCue/roleplay/attribute (pre-sliced small), C.A.R.E + analyze/suggest (zod max 8000 ≈ 2k tok, safe), display/GET
paths (must keep full text), built-in code-managed KBs (safe). See closure.md residual for the C.A.R.E exclusion.

## Findings
No findings — the fix is the finding (a live INV22 re-starvation gap in my own unwired WIP), now closed + gated.
