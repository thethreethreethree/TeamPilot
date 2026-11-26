# CHECK - Acting on the review of erasure, categories and the vocabulary re-apply

## Commands

```
diff 0366's rss_erase_sessions vs 0369's → exactly the lock statement (+ comment)
npm run db:verify → 0369 ok; npm run db:apply → "DB now at 0369" (its live check then lost the connection); npm run verify:live alone → 33 passed
npx vitest run vocabulary vocabularyReapply search reapply → 16 + 23 passed
invariant-audit 0; tsc clean
npm run check → gates the commit
```

## Findings

### F1 - re-applying could grow text and re-spend AI
class: a non-idempotent replace.
sweep: applyCorrections (new lines and the re-apply).
severity: high (latent: the save refuses the shape, production has 0 vocabularies)

### F2 - AI re-runs could outlast the route
class: work after the response bounded by the same time limit.
sweep: the re-apply route.
severity: medium

### F3 - erasure vs a concurrent new transcript version
class: a missing shared lock.
sweep: rss_erase_sessions.
severity: low

### F4 - capped category read in search
class: an unordered capped read where the latest row matters.
sweep: search's category filter (team stats already used the paged reader).
severity: low
