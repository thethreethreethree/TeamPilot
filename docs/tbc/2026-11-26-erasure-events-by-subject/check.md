# CHECK - Legal erasure reaches a call's events wherever they were filed

## Commands

```
diff 0343 vs 0350 rss_erase_sessions → only the two company pins removed (+ comments)
node replay0350.mjs → 0343 erasure left: B/sales_session:A-call (mis-filed survived) B/sales_session:B-call · 0350 erasure left: B/sales_session:B-call
npm run invariant:audit → Violations: 0 (0350 registered as an erasure extension)
npm run db:apply → applying 0350_erasure_events_by_subject.sql … ok · ALL 33 invariants hold
npx vitest run erasureCoverage → 3 passed
```

## Findings

### F1 - an erasure left mis-filed call events in place
class: a company pin on rows whose company column can be wrong.
sweep: call events and task-event scrub matched by verified subject; other erasure steps match by session/pitch ids, not company stamps.
severity: high

## Final

```
node otherMismatch.mjs (production, counts only) → 0 mismatched rows in each of 10 other call tables
npm run check → exit 0 · Test Files 963 passed | 1 skipped · Tests 6949 passed | 15 skipped
```
