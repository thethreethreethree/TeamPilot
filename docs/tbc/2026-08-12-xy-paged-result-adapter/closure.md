# CLOSURE — fetchAllPagedResult adapter

## What shipped
The fetchAllPaged→`{data,error}` adapter — duplicated across admin/coach-readout (a local `pagedEventCount`) and
brain/learning-summary (inline `.then/.catch`), untested in both — is now one exported, unit-tested helper
`fetchAllPagedResult` in paginate.ts. Both routes call it; their §3.4 error-combines receive the identical shape,
so honest-error behaviour is unchanged. This guards the load-bearing error-propagation the session's false-limit
fixes introduced, and removes the divergence risk of two copies. Behaviour-preserving.

## Verification (A38) — real gate output
`npm run check` — full gate, exit 0:

```
$ npm run check
typecheck ✓ · lint ✓ · theme:audit ✓ (0 leaks) · rls:audit ✓ (0 without RLS)
invariant:audit ✓ — Files scanned 773 · Violations 0
tbc ✓ — docs · manifest · artifacts · residual · freshness — all ✓
test ✓ — Test Files 399 passed | 1 skipped (400); Tests 2750 passed | 15 skipped (2765)
EXITCODE=0
```

paginate suite: `npx vitest run src/lib/supabase` → 22 passed (the 2 new fetchAllPagedResult cases + the existing
fetchAllPaged/self-cleaning coverage).

## Residual (A36 — top OPENED)
```json
[
  { "id": "R1", "item": "admin/coach-readout + brain/learning-summary still lack a full route-level test (the multi-read handler + aggregations).", "why_skipped": "Pre-existing (both were untested before this session too); the audit-provenance record classes such large IO/route handlers as low-consequence coverage, and this build guards the load-bearing ADAPTER they share rather than mocking the whole handler.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-12T15:20:00Z", "outcome": "Opened + assessed: acceptable — the extracted adapter is the part with real branching logic (error propagation) and it is now tested; a full route test is a larger, lower-value follow-up." }
]
```

## Un-named reliance
- Relies on both call sites' error-combines treating a truthy `error` the same way they did the inline/local
  adapter's Error — confirmed by reading `chainReadError` (brain) + `secondaryReadError` (admin), unchanged.

## Status
Complete; full gate exit 0 (pasted above). Commit with the TBC-Build trailer + explicit paths, then push.
