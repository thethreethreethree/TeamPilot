# BUILD — DRY the rep-name lookup across the 5 sales extension routes

## Doc integrity (§0.1)
```
$ sha256sum CLAUDE.md ThinkerThinker.md
e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f  CLAUDE.md
0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc  ThinkerThinker.md
```
Match DOC_MANIFEST.json; no governing-doc change, no AMD required.

## Change

### Shared rep-name resolver
`src/lib/coach/extension/repName.ts` (new).

- **write-path:** `resolveRepName(userId)` — admin `profiles.full_name` lookup, trimmed; generic "the sales
  rep" fallback on a blank/missing name OR any thrown error (never throws). Line-for-line the inline block.
- **read-path:** the 5 routes call it; it is unit-tested directly (5 cases: name / blank / no-row / non-string
  / throw).

### Five routes call the helper
`src/app/api/coach/extension/{dissect,coach,summarize,copilot,formulate}/route.ts`.

- **write-path:** each route's ~12-line inline block becomes `const repName = await resolveRepName(user.userId);`,
  and the now-unused `createAdminClient` import is replaced by the `resolveRepName` import.
- **read-path:** each route threads `repName` into its engine exactly as before; the route tests' existing
  `createAdminClient` mock still intercepts the helper's lookup, so their "repName threaded" assertions hold.

## Four-layer pre-walk (§1.5.1)
- **L1 structure:** one helper, five thin call sites; ~55 duplicated lines removed. Cleaner.
- **L2 effect:** behavior identical — same query, trim, fallback, never-throw; tested.
- **L3 continuity:** none (internal refactor; no user-facing change).
- **L4 surface:** none.

## Verdict: SHIPPABLE
A behavior-preserving DRY extraction with the fallback contract now test-locked; no external behavior change.

## Files
- `src/lib/coach/extension/repName.ts`
- `src/lib/coach/extension/__tests__/repName.test.ts`
- `src/app/api/coach/extension/dissect/route.ts`
- `src/app/api/coach/extension/coach/route.ts`
- `src/app/api/coach/extension/summarize/route.ts`
- `src/app/api/coach/extension/copilot/route.ts`
- `src/app/api/coach/extension/formulate/route.ts`
