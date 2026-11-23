# CHECK - The rep's own weekly coaching routine

## Commands

```
npx vitest run routine.test.ts feedback.test.ts my-coaching RepRoutine.render.test.tsx coaching-inbox → 5 files, 23 passed
mutation: my-coaching route without the "answered in the last 7 days" filter → 2 failed; restored from backup
npm run check (before the record was complete) → every code gate passed through sql:harness; ✗ tbc:artifacts (check.md, closure.md missing)
```

## Findings

### F1 - "answered" had one rule in the manager inbox; the rep view needed the answer time too
class: a second copy of a gate decision (§2.2).
sweep: `grep -rn "isRequestOpen" src` → coaching-inbox route, feedback-request route, my-coaching route; all now share
the one `answers()` test inside feedback.ts (isRequestOpen and the new requestAnsweredAt both call it); tested that both
agree on the same events.
severity: low

## Final

```
npm run check → first: ✗ tbc:artifacts (closure wording claimed a verification no command backs) → reworded → exit 0 · Test Files 887 passed | 1 skipped · Tests 6581 passed | 15 skipped
```
