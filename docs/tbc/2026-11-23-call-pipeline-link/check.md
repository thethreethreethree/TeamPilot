# CHECK - Link a call to its prospect, from any call view

## Commands

```
npx vitest run "src/app/api/coach/remote/[id]/pipeline-link" → 5 passed · MacroCallView.render.test.tsx → 10 passed
npm run check → exit 0 · Test Files 869 passed | 1 skipped · Tests 6526 passed | 15 skipped
```

## Findings

### F1 - the control was unreachable in the full call view and could only create a new prospect
class: a workflow step offered in one mode only, with one of two needed choices.
sweep: `grep -rn "<MacroCallView\|ProspectStrip" src` → the strip's only mount was Macro Mode's view; now removed in
favor of CallPipelineLink in both views.
severity: high (0 linked calls in production)
