# CHECK - The KPI headline cards follow the team picker

## Commands

```
npx vitest run kpi/me → 10 passed (team narrows the pooled reps; tree refusal 404; non-admin self, canPool false)
npx vitest run dashboard/sales-coach/kpi → 2 passed (team narrows the cards; no pooled line or switch for a non-pooler)
npx tsc --noEmit → clean
```

## Findings

### F1 - the pooled label over a manager's own numbers
class: the page re-derived the server's scope decision.
sweep: other isCompany copy on the page now reads the same verdict; the switch reads canPool.
severity: medium

### F2 - the KPI page had no render test
class: an untested surface.
sweep: one added for the scope labels.
severity: low
