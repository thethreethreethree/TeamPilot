# CHECK - Go straight to a call nobody has coached

## Commands

```
npx vitest run feedback.test.ts + CoachingInbox renders + coaching-metrics routes → 24 passed
```

## Findings

### F1 - a call with no client name would be a blank link
class: an optional label rendered without a fallback.
sweep: the other new text (dates) is always present.
severity: low

## Final

```
npm run check → exit 0 · Test Files 917 passed | 1 skipped · Tests 6742 passed | 15 skipped
```
