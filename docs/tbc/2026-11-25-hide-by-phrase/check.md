# CHECK - A company phrase hides a call (stage 1)

## Commands

```
node replay0337.mjs (PGlite 0001–0337, signed in) → before a hide: manager 1/1 · rep 1/1 · admin 1/1; hidden: manager 0/0 · rep 1/1 · admin 1/1; after an unhide: manager 1/1
npm run db:apply → 0337 ok; 0338 ok · verify:live → ALL 33 invariants hold
npx vitest run hide-phrases route + [id]/hidden route + hidePhrases lib → 14 passed
npx vitest run library + shared route → 11 passed (incl. "a grant doesn't open a call hidden by a company phrase")
npm run rls:audit → first ✗ four tables "never enable row level security" (0337 did it in a DO loop the audit can't read) → 0338 restates it; then 12 missing ops → allowlisted (writers named; append-only) → ✓
npx vitest run src/lib/__tests__ → erasureCoverage ✗ call_hides unlisted → listed (admin phrase, no transcript words) → 73 passed
```

## Findings

### F1 - the audits couldn't see the new tables' row security
class: security set by dynamic SQL is invisible to text-reading audits, so they report "no RLS" (or, worse, would miss a real gap).
sweep: 0338 restates the four tables' RLS and append-only rules as plain statements; production unchanged (idempotent).
severity: medium

### F2 - a grant or the library could open a hidden call
class: service-role reads bypass RLS, so the database hide doesn't reach them.
sweep: library and shared routes call hiddenFrom (the SQL authority by rpc); the shared route test proves a grant doesn't open a hidden call. Other service-role call reads are stage 2.
severity: high

### F3 - a failed backfill read would say "checking 0 calls"
class: a failed read reported as no data.
sweep: the POST returns checking:null on a read error and the panel says recent calls couldn't be checked (tested).
severity: low

### F4 - a missing service key in the phrase scan would break call processing
class: a "best effort" step that can throw before its own try (the client was made by the caller).
sweep: scanCallForHidePhrases makes its client inside its try and returns null on any failure, including a failed session read; tested (no key → null; failed read → null). Found by npm run check: 5 artifact/finalize tests failed on the missing key.
severity: high

## Final

```
npm run check → first ✗ tbc:artifacts (check.md/closure.md not yet written) → written; second ✗ 5 tests (generateSessionArtifacts, finalize: SUPABASE_SERVICE_ROLE_KEY is missing) → F4 fixed → third run exit 0 · Test Files 944 passed | 1 skipped · Tests 6849 passed | 15 skipped
```
