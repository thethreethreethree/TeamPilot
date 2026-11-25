# CHECK - An admin gives one teammate access to one call

## Commands

```
node replay0336.mjs (PGlite 0001–0336) → grant ACCEPTED · empty reason refused · revoke ACCEPTED · second revoke refused · notification type ACCEPTED · delete leaves the grant
npm run db:apply → applying 0336_call_access_grants.sql … ok
npx vitest run callGrants + shared route + grants route → 9 passed; the own-rep test rewritten (it compared a value with itself) → 5 passed
```

## Findings

### F1 - a shared view could reveal a trimmed section
class: a second player for the same audio.
sweep: the shared player applies the call's active trims (skipTo), like the call page's.
severity: medium

### F2 - a missing grant could confirm a call exists
class: different errors for "no access" and "no such call".
sweep: the shared route answers 404 before reading anything about the call (tested: no reads).
severity: medium

### F3 - one of my own tests asserted nothing
class: a self-comparing expectation.
sweep: the other new tests assert concrete values.
severity: low

## Final

```
npm run check → first: typecheck (test response types) → typed; ✗ service-role tenant (transcript view has no company_id) → allowlisted with the grant guard; ✗ erasureCoverage (call_access_grants unlisted) → listed (admin note; notices already scrubbed by 0316/0317) → exit 0 · Test Files 941 passed | 1 skipped · Tests 6832 passed | 15 skipped
```
