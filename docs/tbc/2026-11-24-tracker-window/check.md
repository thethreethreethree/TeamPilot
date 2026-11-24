# CHECK - Tracker window: only the first N minutes

## Commands

```
node replay0335.mjs (PGlite 0001–0335) → windowed tracker ok · window change refused · 5 s window refused · switch off still ok
npm run db:apply → applying 0335_tracker_window.sql … ok
npx vitest run trackers + smartTrackerScan + trackerScan + trackers routes + KeywordTrackers.smart → first: 1 failed (the smart form's request now carries withinFirstMinutes: null) → expectation updated → 41 passed
```

## Findings

### F1 - an untimed line could be counted as "in the first minutes"
class: a time-based rule over data that may have no time.
sweep: both scanners and the preview go through inWindow(); trackers without a window are unchanged.
severity: medium

## Final

```
npm run check → exit 0 · Test Files 930 passed | 1 skipped · Tests 6787 passed | 15 skipped
```
