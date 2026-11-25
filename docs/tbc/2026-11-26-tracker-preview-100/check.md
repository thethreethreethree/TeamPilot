# CHECK - Tracker preview on 100 calls

## Commands

```
npx vitest run trackers/preview --reporter=verbose → 4 passed (incl. "checks up to 100 calls, only inside the tracker's dates, reading transcripts in call-then-line order")
npx vitest run KeywordTrackers → passed · npx tsc --noEmit → clean
```

## Findings

### F1 - paged transcript read in an unstable order
class: paging ordered by a non-unique key across many calls.
sweep: ordered by session_id then seq; chunked per 25 calls. Other multi-call paged reads found today (coverage) page per chunk with an id order.
severity: medium

### F2 - the preview ignored the tracker's dates
class: preview and scan disagreeing.
sweep: same window (tested).
severity: low

## Final

```
npm run check → first ✗ tbc:manifest (§3.1.1 reason too short) → rewritten → exit 0 · Test Files 962 passed | 1 skipped · Tests 6944 passed | 15 skipped
```
