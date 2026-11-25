# CHECK - Follow a saved search and see its new calls

## Commands

```
node replay0342.mjs (PGlite 0001–0342, signed in) → bad kind: refused · after update+delete: follow · owner sees: 1 · admin (not owner) sees: 0
npm run db:apply → applying 0342_saved_search_follows.sql … ok · ALL 33 invariants hold
npx vitest run saved-searches + savedSearchFollow → first ✗ the old GET test (mock had no events table) → mock extended + follow tests → 13 passed
npx vitest run search page → 5 passed (2 URL + 3 follow)
npm run rls:audit → ✗ saved_search_events insert/update/delete → allowlisted (writer named; append-only) → ✓
```

## Findings

### F1 - a background matcher would bypass access
class: service-role matching for a person.
sweep: matching runs on read through the owner's client; nothing in the background.
severity: high (avoided by design)

### F2 - a failed run would show as "nothing new"
class: failure read as empty.
sweep: newCount null → "?" on the page; tested.
severity: low

### F3 - the search's own from-date could be ignored
class: a filter overwritten by the follow window.
sweep: the later of the two applies; tested.
severity: low

### F4 - an old follow could fall off a capped read
class: a .limit above PostgREST's 1000-row cap (a false bound) on an append-only log.
sweep: the events read is paged (fetchAllPagedResult); found by npm run check's invariant audit.
severity: medium

## Final

```
npm run check → first ✗ invariant audit: .limit(2000) > PostgREST max_rows → paged → exit 0 · Test Files 954 passed | 1 skipped · Tests 6899 passed | 15 skipped
```
