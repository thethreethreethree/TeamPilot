# CHECK - Market: competitors and topics across calls

## Commands

```
npx vitest run market.test.ts + market route → 6 passed
npm run check → first: ✗ lint (no-assign-module-variable: `module` in the route → renamed callModule), then
  RemoteSalesShell tab test (manager list now includes Market → expectation updated) → exit 0 · Tests 6555 passed | 15 skipped
```

Production, read-only (shape and volume before parsing):

```
{"n":316,"companies":8,"with_comp":174} · payload keys: intel 316, coach_version 316
```

## Findings

### F1 - topics are free phrases and fragment
class: AI-written topic labels vary in wording ("Price", "pricing concerns").
sweep: `grep -n "norm" src/lib/coach/remote/market.ts` → grouping ignores case and spacing only.
severity: low

### F2 - Sales Coach (in-person) has no Market tab yet
class: the route takes module=sales_coach, but no Sales Coach screen mounts MarketView.
sweep: `grep -rn "MarketView" src/app` → Remote Sales only.
severity: low
