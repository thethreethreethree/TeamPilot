# CHECK — fetchAllPagedResult adapter

## Verification run (A38)
Canonical command: `npm run check`.

## Findings
### F1 — the fetchAllPaged→{data,error} adapter was duplicated across two routes and untested in both
file+line: `admin/coach-readout/route.ts` (local `pagedEventCount`) · `brain/learning-summary/route.ts` (inline
`.then/.catch`). Both map fetchAllPaged's throw back to `{data,error}` for their §3.4 error-combines.
class: reuse/coverage — load-bearing error-propagation logic duplicated + untested (a broken map would swallow a
read failure into a false empty, defeating the honest-error path).
severity: low (behaviour is currently correct) — but unguarded against regression + divergence between the copies.
sweep-command: `grep -rn "instanceof Error ? error : new Error" src/app/api` + `grep -rn "pagedEventCount" src` —
after the fix, the only adapter copies are gone (pagedEventCount deleted; brain's inline `.then/.catch` replaced),
and `grep -rn "fetchAllPagedResult" src` shows both routes now share the one tested helper. No third inline copy
exists elsewhere in the API surface.
remediation: extract one exported `fetchAllPagedResult`, unit-test it, wire both sites (see remediate.md).

## Tests
```
$ npx vitest run src/lib/supabase
 Test Files  4 passed (4)
      Tests  22 passed (22)
```
The 2 new tests pin the adapter both directions: success pages the full set → `{data, error:null}`; a labelled
read error → `{data:null, error:<Error 'readout events failed: boom'>}` and NEVER throws (Promise.all-safe).

## Full gate
```
PENDING — pasted in closure after the run
```
