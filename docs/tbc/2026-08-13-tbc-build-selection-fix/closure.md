# CLOSURE — TBC build-selection fix

## What shipped
`currentBuildDir()` now selects the build to validate by its think.md `started_at` (most-recently-started), not by
the lexicographically-last directory NAME. This closes a gate blind spot found this session: a newer same-day dir
whose name sorted earlier (`display-honesty` after `forced-client-update`) was silently skipped, so its record
shipped unvalidated. The selection is the pure, unit-tested `pickLatestBuildName`; downstream verifiers and the
`TBC_BUILD=` override are unchanged. This build dir itself (started 11:00) is now the one `currentBuildDir` picks —
so the gate below is validating it under the new logic (self-demonstrating).

## Verification (A38) — real gate output
`npm run check` — full gate, exit 0:

```
$ npm run check
typecheck ✓ · lint ✓ · theme:audit ✓ (0 leaks) · rls:audit ✓ (0 without RLS)
invariant:audit ✓ — Files scanned 773 · Violations 0
tbc ✓ — docs · manifest · artifacts · residual · freshness — all ✓ (validating THIS dir, the newest-started)
test ✓ — Test Files 401 passed | 1 skipped (402); Tests 2764 passed | 15 skipped (2779)
EXITCODE=0
```
`pickLatestBuild`: 5 tests incl. the exact regression. Live probe confirmed `currentBuildDir()` picks the
newest-started dir.

## Residual (A36 — top OPENED)
```json
[
  { "id": "R1", "item": "currentBuildDir's file IO (readdirSync + reading each think.md) is not unit-tested — only the pure pickLatestBuildName is.", "why_skipped": "The IO is thin glue over the tested pure selection; a fs-mocking harness for lib.mjs would be a larger scaffold for little added assurance, and the live probe exercised the real IO path.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-13T11:10:00Z", "outcome": "Opened + assessed: accepted — the branch logic is the pure function (tested); the IO is a map over readdir + frontMatter, both already used across the gate." },
  { "id": "R2", "item": "The fix relies on every build dir carrying a `started_at` in think.md.", "why_skipped": "Verified true for all current dirs; and the fallback keys a missing-started_at dir on its name so it can only win if NONE has one — a graceful degrade, not a crash.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-13T11:11:00Z", "outcome": "Opened + assessed: safe — tbc:docs/manifest already require think.md frontmatter, so a started_at-less dir is malformed on other axes too." }
]
```

## Un-named reliance
- Relies on `started_at` being an ISO-8601 instant (lexicographically sortable = chronologically sortable) — the
  frontmatter convention every build in this session follows.

## Status
Complete; full gate exit 0 (pasted above), self-demonstrating (the gate validated this newest-started dir). Commit
scripts/tbc/lib.mjs + the test + this TBC dir with explicit paths, then push.
