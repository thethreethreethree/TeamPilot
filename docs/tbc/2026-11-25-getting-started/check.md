# CHECK - First-week checklist on Remote Sales

## Commands

```
npx vitest run getting-started route + remote-sales components → first: 1 failed (a Calls test assumed the list fetch came first) → find by URL → 105 passed
```

## Findings

### F1 - the founder's example "read Highlights" isn't recorded
class: a step that could only be self-reported.
sweep: the four steps each map to a stored row (coaching_sessions, remote_checklist_reviews, remote_prospects, training_attempts).
severity: low

## Final

```
npm run check → exit 0 · Test Files 938 passed | 1 skipped · Tests 6823 passed | 15 skipped
```
