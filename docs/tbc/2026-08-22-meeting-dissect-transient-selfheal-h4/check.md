# CHECK — Meeting Dissect: transient self-heal (audit H4)

## Gate — the canonical command (A38)

```
$ npm run check
 Test Files  559 passed | 1 skipped (560)
      Tests  3681 passed | 15 skipped (3696)
EXIT: 0
```

(Targeted suites: parseMeetingDissect 15, generateAndStoreMeetingDissect 11, dissect route pass.)

## What the tests prove
- **Parse outcome:** unparseable / array / non-object → `transient`; valid-but-empty JSON → `empty`; a real
  dissect → `signal`. The malformed test updated for the new `outcome` field.
- **Store (the H4 core):** a transient run writes **NO** backoff marker — asserted for empty LLM text, a thrown
  LLM call, and an unparseable response (`state.inserts` length 0). A genuine empty (valid JSON, empty arrays, or
  zero segments) still writes the `dissect_attempted` marker with reason `no_signal`. A signal writes
  `dissect_generated`.
- **Route:** the existing dissect route tests still pass (the 503 transient branch is additive).

## Honest limit
The real token-starvation blip can't be reproduced live; it's simulated by the LLM mock returning empty/garbage or
throwing — the exact shapes the classification keys on. Legacy `no_signal` markers from before this change stay
empty (residual; `?force=1` recovers).

## Findings
**No findings.** No schema change; the sales dissect already self-heals and was untouched; cost-loop protection is
retained for the genuine-empty case.
