# CHECK - Edit or remove your own call comment

## Commands

```
node replay0333.mjs (PGlite 0001–0333) → edit ACCEPTED · remove ACCEPTED · empty edit refused · remove with body refused · after update+delete attempts: 2 rows, body unchanged
npm run db:apply → applying 0333_comment_revisions.sql … ok
npx vitest run commentRevisions + comment route (POST, PATCH) + RemoteCallComments renders + recordings + sales-coach → 564 passed
```

## Findings

### F1 - an edit could bring back a removed comment
class: a later write undoing a deliberate removal.
sweep: the only writers of revisions are the two PATCH branches; both read the latest revision first.
severity: medium

### F2 - the rep's bell excerpt keeps the original text
class: a copy made at send time (notification payload excerpt).
sweep: recording_comment and comment_mention notifications store a 160-character excerpt.
severity: low (recorded as a residual)

## Final

```
npm run check → first: ✗ RLS policy gaps (revisions insert/update/delete: service-role writer + append-only) → allowlisted with reasons → exit 0 · Test Files 920 passed | 1 skipped · Tests 6755 passed | 15 skipped
```
