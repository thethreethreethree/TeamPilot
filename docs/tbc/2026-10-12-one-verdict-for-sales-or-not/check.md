# CHECK - one verdict for "is this a sales call"

## Commands

```
$ npx tsc --noEmit -p .                                                                  exit 0
$ npx vitest run src/lib/coach/v5 src/lib/coach/pitchScore src/lib/coach/strategy src/app/api/coach/sales-session src/app/dashboard/sales-coach
      Test Files  200 passed (200)   Tests  1703 passed (1703)
$ node scripts/invariant-audit.mjs                                                       Violations: 0
$ (mutation: scoreSession back to `session.sessionKind !== "sales"`)  invariant-audit   1 violation (restored)
```

The full `npm run check` is appended below.

## Findings

### Three hand-written copies of "is this a sales call"

class: a re-derived verdict next to its authority (CLAUDE.md §2.2)
sweep: every `sessionKind`/`session_kind` comparison to a kind literal in src (6 lines): 2 consume resolveCoachingMode, 1 is the insert's storage choice (exempt), 3 were copies
severity: low

No production divergence (the column is never empty), so no behaviour changed; the risk was future drift.

### A meeting opened from the sales list reaches tools that can only fail

class: a refusal with no next step (§1.5.1 layer 3)
sweep: every caller of the six guarded routes in src/components, src/app and the iOS app
severity: low

Expert mode only (Standard hides the tools). Now a link to the meeting review.

## Not opened

No image, icon, logo, favicon or graphic asset was touched.

## Full gate (2026-10-12)

```
$ MIGRATION_AUDIT_PSQL="docker exec -i pgprobe54 psql -U postgres" PGHOST=localhost PGPORT=54329 PGUSER=postgres PGPASSWORD=postgres npm run check
  Violations: 0
  Tests  5725 passed | 15 skipped (5740)
  exit 0   (no SKIPPED line)
```
