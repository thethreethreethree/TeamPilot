# CHECK - What the team's calls cover

## Commands

```
npx vitest run coverageShare → 3 passed
npx vitest run coverage route → 4 passed · TeamCoverage render → 4 passed
npx tsc --noEmit → clean · eslint (new files) → clean · theme-audit → No theme-bound leaks
node intelShape.mjs (production, counts only) → intel events {"total":316,"with_topics":316,"on_remote_calls":7} · trackers/hits {"trackers":0,"hits":0}
```

## Findings

### F1 - a hidden call's AI reads were readable, which this panel would have counted
class: call content in a text-subject table outside the hide.
sweep: fixed and shipped before this panel (0341, 02c23b2d); this panel reads through RLS.
severity: high

### F2 - a topic link can show more calls than the share counted
class: two matching rules (exact label here, substring in Search).
sweep: the panel says so under the shares; tracker links match exactly.
severity: low

### F3 - with no trackers the panel would show an empty half
class: empty state with no next step.
sweep: it links to setting up a tracker (tested).
severity: low

## Final

```
npm run check → exit 0 · Test Files 951 passed | 1 skipped · Tests 6888 passed | 15 skipped
```
