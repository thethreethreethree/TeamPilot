# CHECK - Ask Coach prompt library

## Commands

```
npx vitest run promptLibrary.test.ts + americanSpelling.test.ts → 5 passed, exit 0
npm run check → exit 0 · Test Files 865 passed | 1 skipped · Tests 6508 passed | 15 skipped
```

## Findings

### F1 - prompts are not tested against real answers
class: AI prompts whose usefulness is judged by wording, not outcomes.
sweep: `grep -c "id:" src/lib/coach/remote/promptLibrary.ts` → 20 prompts, none yet run against a real call or pipeline.
severity: low

### F2 - no team-made prompts
class: a fixed library where Gong lets teams save their own.
sweep: `grep -rn "saved_prompts\|custom prompt" src/lib` → none.
severity: low
