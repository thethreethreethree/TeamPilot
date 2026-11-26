# CHECK - Call categories: an admin's list, the rep's pick

## Commands

```
npm run db:verify → 0367 ok; npm run db:apply → verify:live passed
npx vitest run callCategories category call-categories CallCategoryPicker → 7 passed
noFailedReadAsEmpty, americanSpelling → passed; invariant-audit 0; rls-audit passed; theme clean; reachability passed; tsc clean; eslint clean
npm run check → gates the commit
```

## Findings

### F1 - calls had no category
class: missing feature (F10.10), founder-decided shape.
sweep: phone/video calls.
severity: medium
