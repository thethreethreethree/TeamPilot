# CHECK - Fixes from the review of the day's builds

## Commands

```
review subagent: 15 commits read; findings 1–6 above; each re-read here before fixing
npx vitest run applyOverride + feedback + TeamCallStats + RemoteCallsHome + RemoteToday + coaching-metrics + coaching-inbox + smartTrackerScan + scenarios → 87 passed
#6 test strengthened (request on a call outside the read) → on the old route: 1 failed; on the fix: 4 passed
```

## Findings

### F1 - N/A could zero Delivery on a no-objection pitch
class: a guard that missed an item the scorer already excludes.
sweep: the only other exclusion rule in scorePitch is the objection one; the guard now mirrors it.
severity: medium

### F2 - a removed comment still counted as feedback
class: a new revision table not read by an older reader.
sweep: readers of recording_comments — readRecordings (uses revisions), feedback.ts (fixed), share/comment routes (write only).
severity: medium

### F3 - "1:60" in team call stats
class: rounding a remainder instead of the total.
sweep: other m:ss helpers in today's files (RemoteCallPanel, TeamUsage) round the total first.
severity: low

### F4 - Calls bounced to Today after Today was open
class: a shared fact written in one place only.
sweep: the key is now only in todayShown.ts.
severity: low

### F5 - a false "respects the guidance gate" claim
class: a comment and test describing a state the engine can't produce.
sweep: the same test name in smartTrackerScan.test.ts, fixed.
severity: low (behaviour matches the recorded day-1 decision)

### F6 - requests about old calls counted as open
class: two reads with different windows joined.
sweep: the by-rep rows are the only join of requests and events in this route.
severity: low

## Final

```
npm run check → first: ✗ tbc:artifacts (a flow without a write-path line) → added → exit 0 · Test Files 931 passed | 1 skipped · Tests 6795 passed | 15 skipped
```
