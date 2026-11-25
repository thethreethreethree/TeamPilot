# CHECK - An event about a call carries the call's company

## Commands

```
node ownEvents2.mjs (production, rolled back) → a rep with calls: 350 own-company call events with 0348, 615 without (265 teammates'); 76 of their calls' events carry another company
node mismatch.mjs (production, counts only) → 233 call events stamped with 4 other companies, 2026-08-09..17, all at 16:00, actor = the call's rep
node replay0349.mjs → service write stamped B → stored as A (the call's) · rep of A on A's call: accepted · user of B on A's call: refused · user of B unrelated event: accepted · malformed call subject: refused (0348's read rule on RETURNING)
npm run db:apply → applying 0349_call_events_company_from_call.sql … ok · ALL 33 invariants hold
npx vitest run hideCoverage → 6 passed
```

## Findings

### F1 - call events filed under the author's company
class: a tenant column taken from the writer instead of the subject.
sweep: both call subject forms (sales_session:, pitch:) corrected at insert.
severity: high

### F2 - a doc commit went in before a full check
class: process slip (memory: commit only after a green check).
sweep: the check was run right after (exit 0); this build commits only on a green check.
severity: low

## Final

```
npm run check → exit 0 · Test Files 963 passed | 1 skipped · Tests 6948 passed | 15 skipped
```
