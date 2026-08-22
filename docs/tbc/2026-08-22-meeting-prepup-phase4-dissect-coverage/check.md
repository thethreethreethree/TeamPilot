# CHECK — Prep-up Phase 4: Dissect agenda coverage

## Gate — the canonical command (A38)

```
$ npm run check
 Test Files  558 passed | 1 skipped (559)
      Tests  3669 passed | 15 skipped (3684)
EXIT: 0
```

All gates exit 0. Dissect pipeline + review UI change; no schema change; prep-less meetings unaffected.

## What the tests prove
- `generateAndStoreMeetingDissect` with an agenda stores `payload.agenda` = {goal, goalAttained, topics}: the
  LLM's covered ids map onto the topic texts (t1 covered, t2 missed → surfaced); a prep-less meeting stores
  `agenda: null` (no regression). Existing dissect tests (signal / attempted-marker / balance) still pass.
- `parseMeetingDissect` (the consequence parse) is unchanged; the agenda judgment is a separate helper.

## Honest limit
The goal-attainment + coverage judgments are the model's read of the diarized transcript; a real run is
confirmed at go-live (post-migration) on an actual prepped meeting. Unit-tested here with a fake LLM.

## Findings
**No findings.** Reuses the dissect pipeline + prep data layer; §3.5-clean (measures the agenda outcome, never
the cues); parse stays total/silent-safe; additive.
