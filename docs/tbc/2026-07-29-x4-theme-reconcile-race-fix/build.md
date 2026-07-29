# BUILD — theme reconcile race fix

File: `src/components/theme/ThemeProvider.tsx` (the DB-reconcile effect only).

### Re-read guard against clobbering a mid-flight choice

- write-path: **exists** — after `fetch("/api/me/theme")` resolves, the effect now re-reads
  `localStorage[STORAGE_KEY]` into `freshRaw` and returns early if it is non-null, then passes `freshRaw`
  (not the stale mount-time `localRaw`) to `reconcileTheme`. human_can_set: the user picking a theme mid
  fetch writes localStorage synchronously via setPreference.
- read-path: **exists** — a user who picks a theme while the reconcile fetch is in flight keeps that
  choice; the DB/company value no longer overwrites it. A genuine fresh device (no choice) still inherits
  the DB pref / company default as before. human_can_see: **yes** — their selection sticks.
- reachability: **BUILT** — tsc exit 0; the fresh value flows into reconcileTheme whose local-set branch
  (unit-tested: returns `{preference:null, shouldCache:false}`) makes the clobber impossible.

## Verification (A38)

`npm run check` output + exit code in closure.md's verification record.
