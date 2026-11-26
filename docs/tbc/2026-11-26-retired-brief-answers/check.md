# CHECK - A retired template's answers stay viewable

## Commands

```
npx vitest run brief-templates CustomBriefs.render → 3 + 6 passed
invariant-audit 0; eslint clean; tsc clean
npm run check → gates the commit
```

## Findings

### F1 - a retired template's answers were unreachable
class: a list filtered to "live" where history matters.
sweep: the call's Briefs picker.
severity: low
