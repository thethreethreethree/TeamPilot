# CHECK - Outcome colors and a public status page

## Commands

```
npx tsc --noEmit; eslint (touched files) → first: 5 unused imports after the badge swap → removed → clean
npx vitest run outcomeTone + remote-sales + RecordingsTab + doorlog → 176 passed
npx vitest run src/lib/status src/app/status → 4 + 2 passed
```

## Findings

### F1 - "not set up" would read as an outage on a public page
class: configuration state shown as failure.
sweep: the two config-dependent parts (email, webhooks) get their own "Not switched on" state.
severity: medium

## Final

```
npm run check → exit 0 · Test Files 935 passed | 1 skipped · Tests 6808 passed | 15 skipped
```
