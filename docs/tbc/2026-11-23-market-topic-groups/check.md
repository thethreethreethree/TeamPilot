# CHECK - Group similar topics on Market

## Commands

```
node scratchpad/topics.mjs (read-only, production) → distinct: 720 total: 1430
node scratchpad/topicgroup.mjs (prototype rule, production labels) → labels: 720 → groups: 669 · merged groups: 41 (each printed and inspected; none merges different topics)
npx vitest run market.test.ts InsightViews.render.test.tsx market route → 14 passed
mutation: topics grouped without topicKey → market.test.ts 1 failed; restored from backup
```

## Findings

### F1 - a second wording of the same topic on one call was dropped from the wordings list
class: deduping per call before recording what was seen.
sweep: group() is the only grouping loop in market.ts; competitors use the same loop (now also keep every spelling).
severity: low

### F2 - "speed" was cut to "spe" by the -ed rule in the first prototype
class: suffix rules applied to words where the letters are part of the stem.
sweep: rule now skips -eed and words of 5 letters or fewer; pinned by test (topicKey("speed") === "speed").
severity: low

## Final

```
npm run check → exit 0 · Test Files 887 passed | 1 skipped · Tests 6584 passed | 15 skipped
```
