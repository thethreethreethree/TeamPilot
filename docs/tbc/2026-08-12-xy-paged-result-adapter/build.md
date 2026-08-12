# BUILD — fetchAllPagedResult adapter (extract + test + consolidate)

## Feature inventory
### One tested `fetchAllPagedResult` helper replaces two untested inline adapters
- write-path: none (read helpers). N/A.
- read-path: `fetchAllPagedResult<T>(makePage, opts)` in paginate.ts wraps `fetchAllPaged` and maps its
  throw-on-error back to Supabase's `{ data, error }` shape (success → `{data, error:null}`; throw →
  `{data:null, error:<Error>}`, non-Error wrapped). Both call sites now use it: admin/coach-readout (was a local
  `pagedEventCount`, now deleted) and brain/learning-summary (was an inline `.then/.catch`). Their §3.4 error
  combines (secondaryReadError / chainReadError) receive the identical shape, so honest-error behaviour is
  unchanged. Guarded by 2 new unit tests (success pages the full 2500-row set; a read error → `{data:null,
  error}` and never throws so a Promise.all sibling isn't rejected).

## Files changed
- src/lib/supabase/paginate.ts — add the exported `fetchAllPagedResult` helper.
- src/lib/supabase/__tests__/paginate.test.ts — 2 unit tests (success + error) for it.
- src/app/api/admin/coach-readout/route.ts — delete local `pagedEventCount`; call the shared helper (3 sites).
- src/app/api/brain/learning-summary/route.ts — replace the inline adapter with the shared helper.

## Holistic (§1.5.1)
Behaviour-preserving consolidation — no read/aggregation/error semantics change. Turns a load-bearing but
duplicated + untested adapter into one tested export. The routes' larger handlers stay as-is (pre-existing
coverage posture); this guards the adapter my xw change introduced.
