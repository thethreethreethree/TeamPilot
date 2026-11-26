# CHECK - Acting on the review of the library and win/loss builds

## Commands

```
npx vitest run mentions winLoss askPipeline prospects library RemotePipeline.render → 7 files, all passed (current-version hits, withCalls, comparable deals, tie cuts, sentiment for 60, listens before saving)
npm run check → see the commit (gated on its exit code)
```

## Findings

### F1 - deals with no readable call counted as "not mentioned"
class: a comparison over a population that couldn't have the property.
sweep: byMention only.
severity: medium

### F2 - hits from an older transcript counted
class: versioned rows read without the current version.
sweep: the mentions route; the adoption board already reads the current version.
severity: low

### F3 - sentiment for every deal, 60 used; unpaged to-do links; O(n·m) grouping; possible duplicate deal
class: work and caps over a no-longer-capped list.
sweep: listProspects, readDealSentiment, askPipeline.
severity: low

### F4 - folder usage counted plays from before saving; label said "newest"
class: a count wider than its label.
sweep: the library route and page.
severity: low

### F5 - previous person's pipeline shown briefly after switching
class: stale state across a key change.
sweep: RemotePipeline.
severity: low
- npm run check → first run EXIT 1 (invariant: session_interaction_stats paged without a unique last key); fixed (order by id); rerun gates the commit
