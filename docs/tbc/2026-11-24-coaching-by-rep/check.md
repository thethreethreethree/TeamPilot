# CHECK - Coaching by rep

## Commands

```
npx vitest run feedback.test.ts → 17 passed (4 new: D8 per rep, overdue, no-calls rep, sort)
npx vitest run CoachingInbox renders + coaching-metrics route tests → 7 passed, then 4 passed with the byRep assertion
```

## Findings

### F1 - a rep with no calls would read as overdue
class: an absence of evidence read as a failure.
sweep: overdue is the only verdict in the row; it requires calls in the window.
severity: medium

## Final

```
npm run check → exit 0 · Test Files 917 passed | 1 skipped · Tests 6742 passed | 15 skipped
```
