# CHECK - Acting on the review of the folder, filler and tracker builds

## Commands

```
npm run db:verify → 0363 ok; npm run db:apply → verify:live passed
production Postgres, one rolled-back transaction → 9/9 (move to top; branch to 3 levels; loop refused; into itself refused; 4 levels refused; two name clashes refused; a clash-free move allowed; create at 4 levels refused)
npx vitest run coverageShare coverage stats library KeywordTrackers remote-sales → 154 passed
noFailedReadAsEmpty, americanSpelling → 7 passed; invariant-audit 0; theme clean; tsc clean; eslint clean
npm run check → gates the commit
```

## Findings

### F1 - a branch couldn't be moved
class: an action placed only where items are.
sweep: both folder lists.
severity: medium

### F2 - coverage divided by calls a tracker never hears
class: the adoption fix not applied to the second reader.
sweep: every 'share of calls' reader for trackers (adoption, coverage).
severity: medium

### F3 - "uh-huh" counted as a filler
class: a word boundary that includes hyphens.
sweep: FILLER_RE (the post-call count); the live-coaching filler list is separate (residual).
severity: low

### F4 - concurrent moves could loop; unbounded walk
class: a check without a lock.
sweep: both folder guards.
severity: low

### F5 - same-named siblings after a move
class: a promise kept on one write path, not the other.
sweep: the move guard.
severity: low

### F6 - wrong confirmation for a one-type tracker
class: fixed wording.
sweep: both confirmations.
severity: low
