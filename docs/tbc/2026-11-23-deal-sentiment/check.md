# CHECK - Deal sentiment

## Commands

```
npx vitest run dealSentiment, dealRisk, askPipeline, prospects tests + prospects route → 37 passed, exit 0
npm run check → exit 0 · Test Files 868 passed | 1 skipped · Tests 6521 passed | 15 skipped
```

Production, read-only (shape check before trusting the parser):

```
payload keys: [{"k":"coach_version","n":363},{"k":"moments","n":363}]
moment sentiments: neutral 514 · cooling 205 · warming 182 · null 4
linked calls (remote_prospect_calls): 0
```

## Findings

### F1 - no call is linked to a prospect in production yet
class: a derived view whose input is empty, so the feature is invisible until a workflow step happens.
sweep: `select count(*) from remote_prospect_calls` → 0.
severity: medium

### F2 - events.id is a uuid
class: an ordering tie-break written for a number.
sweep: `grep -n "create table if not exists events" -A2 supabase/migrations/0001*.sql` → id uuid; the tie-break was
changed to a string compare before commit.
severity: low
