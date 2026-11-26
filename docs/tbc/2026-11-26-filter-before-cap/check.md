# CHECK - Filter before the cap

## Commands

```
npx vitest run coaching-inbox assignments → 5 passed (a rep's request listed under 400 newer outside requests)
npx vitest run CoachingInbox → 13 passed; tsc → clean
```

## Findings

### F1 - coaching inbox capped the company before the tree
class: limit before filter.
sweep: 63 capped reads; 6 filter afterwards.
severity: medium

### F2 - team assignments capped the company before the tree
class: limit before filter.
sweep: as F1.
severity: medium
