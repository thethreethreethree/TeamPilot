# CHECK - Rank stage practice by what the rep misses

## Commands

```
npx vitest run repNeeds.test.ts → 2 passed (miss 1, partial ½, ≥3 grades; ranked by the weakest tagged need, untagged after)
rubric id probe → every REMOTE/DOOR element id matches ^[A-Za-z0-9_.]{1,80}$ (first DB rule ^[a-z0-9_]{1,60}$ would have refused "intro.reasonForCall" — widened before applying)
npx vitest run stage-practice route + scenarios/elements route → 12 passed (ranking with why; failed read keeps order; made-up item refused; retired scenario refused)
npx vitest run RemotePipeline.stagePractice.render + sales-coach render suites → passed (reason shown on the card)
node scratchpad/replay0326.mjs → current: close.askForOrder (intro.who tagged then untagged) · refused: bad id · rules hold
npm run db:apply → applied 0326 · DB now at 0326 · verify:live → ALL 33 invariants hold
npm run rls:audit → Missing policies 0 (append-only ops allowlisted) · invariant:audit → Violations 0 (tag route allowlisted like the stages route)
```

## Findings

### F1 - the first element-id rule would have refused every real rubric id
class: a constraint written from an assumed id format.
sweep: checked every id in both rubrics against the rule before applying; widened to letters, digits, "_" and ".".
severity: medium (every tag would have failed)

## Final

```
npm run check → exit 0 · Test Files 902 passed | 1 skipped · Tests 6669 passed | 15 skipped
```
