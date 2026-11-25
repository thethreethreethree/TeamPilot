# CHECK - Tracker start and end dates

## Commands

```
node replay0344.mjs → end before start: refused · dated tracker: accepted · change its dates: refused · switch it off: accepted
npm run db:apply → applying 0344_tracker_dates.sql … ok · ALL 33 invariants hold
npx vitest run trackers route + KeywordTrackers → first: 3 failed (pinned insert/body shapes now carry the dates) → updated → 22 passed
npx vitest run trackers route + trackers lib → 32 passed · trackerScan + smartTrackerScan → 13 passed
```

## Findings

### F1 - a dated tracker would still cost an AI call on calls outside its dates
class: filtering after the expensive step.
sweep: the smart scan filters by date before building the AI request.
severity: low

### F2 - "end date" could exclude its own last day
class: date vs timestamp boundary.
sweep: the end counts through the end of that UTC day (rule and backfill tested at the boundary).
severity: low

## Final

```
npm run check → exit 0 · Test Files 962 passed | 1 skipped · Tests 6931 passed | 15 skipped
```
