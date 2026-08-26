# CHECK — View-session authz-review fixes

## Gate — the canonical command (A38)
```
$ npm run check
  (pending paste — filled from the real run below)
```

## What this covers
- F1: a failed team-activity aggregate no longer renders "No sessions" for every rep (activityLoaded gates it).
- F2: rep-activity returns atCap/cap; the header says "Most recent 100 sessions" when the list is capped.
- rate-limit added to team-activity (consistency with siblings).
- Drift guards (8 tests): rep-activity keeps no-audio-filter + company/agent scoping + manager authz; team-activity
  stays manager-gated + own-company scoped.

## Authz confirmed by adversarial review (not a leak)
The security review traced both routes: companyId is server-derived; rep-activity gates on isSalesCoachManager +
canManagerViewRepSkills (same-company) AND double-scopes the query on the caller's company; team-activity is
manager-gated + company-scoped. No tenant leak, no bypass, §A18 compliant. These fixes change none of that.

## Findings
No findings — honesty + consistency fixes on a clean-authz surface, plus source-drift guards locking the fix class.
