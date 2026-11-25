# CHECK - Fixes from the 26 Nov review

## Commands

```
node replay0345.mjs → before 0345 manager: events=pitch hiddenSet=1 | other-company manager: events=- hiddenSet=1 · after 0345 manager: events=- hiddenSet=1 | rep: events=pitch,sales_session hiddenSet=0 | other-company manager: events=- hiddenSet=0 · rss_hidden_calls_for(C, manager): 1 · (C, rep): 0
npm run db:apply → applying 0345_hide_review_fixes.sql … ok · ALL 33 invariants hold
npx vitest run hidePhrases + hide-phrases route → first 5 failed (mocks without paging) → mocks page → 15 passed; + long-transcript and one-RPC tests → 10 passed (lib)
npx vitest run savedSearchFollow + search page + CoachingInbox → passed
```

## Findings

### F1 - a phrase after line 1,000 didn't hide the call
class: unpaged read under PostgREST's 1000-row cap.
sweep: every read in hidePhrases.ts and the hide-phrases route is paged; id lists chunked.
severity: high

### F2 - every signed-in read paid for every company's hides
class: a definer set function without a tenant filter.
sweep: rss_hidden_calls_for_me filtered to auth_company_id(); service-role set function takes the company.
severity: medium

### F3 - dispute notes of a hidden call were readable through events
class: call content under a second subject form (pitch:<id>).
sweep: the hidden-subjects set covers pitch subjects; replayed.
severity: medium

### F4 - follow counts missed calls still processing, and hid uncountable counts
class: a window keyed on the wrong timestamp; a floor shown as nothing.
sweep: ended_at window; 'new?' for capped counts (tested).
severity: medium

### F5 - the inbox kept the previous team's data on a failed switch
class: stale state across a changed query.
sweep: state cleared at each load (tested); TeamCoverage and TeamCallStats already did.
severity: medium

## Final

```
npm run check → first ✗ 17 tests in 8 files (they ran the real hide helpers on mocks without paging or rpc) → paging added to the 3 files that test hides; the other 5 mock the helpers as 'nothing hidden' → 45 passed → exit 0 · Test Files 962 passed | 1 skipped · Tests 6936 passed | 15 skipped
```
