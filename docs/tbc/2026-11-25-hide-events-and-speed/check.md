# CHECK - A hidden call's AI reads are hidden too, and the hide checks run once per query

## Commands

```
node replay0341.mjs (first, per-row form) → before: manager reads sales_session:…e1 …e2 not-a-uuid task:1 · after: manager …e2 not-a-uuid task:1 · rep and admin all four
node eventsCost.mjs (production, one transaction, ROLLED BACK) per-row form → events 125ms → 729ms for 1,330 rows
node replay0341b.mjs (set-based form) → hidden + 0341 — manager: every table 0, events=1, nullSessionPitch=1 · rep and admin unchanged
node eventsCost.mjs set-based → transcript lines 1480ms (current 0337 rules) → 309ms; call events 329ms; all events 205ms; rolled back
npm run db:apply → applying 0341_hide_by_phrase_events.sql … ok · ALL 33 invariants hold
npx vitest run hideCoverage → 4 passed; with the tracker_hits rule pretended away → fails naming tracker_hits; restored → 4 passed
```

## Findings

### F1 - a hidden call's AI reads were readable company-wide
class: a table keyed to a call by a text subject, not a call column — invisible to a rule keyed on session_id.
sweep: events is the only subject-keyed store of call content found; guarded. hideCoverage judges every session_id/pitch_id table with text.
severity: high

### F2 - the hide rules cost a function call per row
class: a correlated function in a row policy.
sweep: all 21 rules rewritten set-based; timed before applying.
severity: medium

### F3 - NOT IN would have hidden every score with no call
class: NOT IN with a nullable key.
sweep: every rule guards `is null or`; replayed.
severity: high (caught before applying)

## Final

```
npm run check → exit 0 · Test Files 949 passed | 1 skipped · Tests 6880 passed | 15 skipped
```
