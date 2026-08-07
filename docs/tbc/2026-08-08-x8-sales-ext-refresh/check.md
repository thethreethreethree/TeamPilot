# CHECK — Sales Coach Extension: shared refresh route + detection-scope fix

## Verification (A38 — canonical command, by name, coverage + exit)
Ran `npm run check` (typecheck && lint && theme:audit && rls:audit && invariant:audit && tbc && test).

```
invariant:audit — Files scanned: 762 · Violations: 0 · "every extension route authenticated" (now care/ + coach/)
tbc — docs ✓ · manifest ✓ · artifacts ✓ · residual ✓ · freshness ✓
test — Tests 2437 passed | 15 skipped
=== check exit code: 0 ===
```
New / affected tests inside that run:
- `src/lib/api/__tests__/extensionRefresh.test.ts` — 5 cases (env-500, renew, refresh-token fallback,
  reject-401, throw-502) on the shared handler.
- `src/app/api/coach/extension/__tests__/refresh.route.test.ts` — 6 cases mirroring the C.A.R.E route.
- `src/app/api/care/extension/__tests__/refresh.route.test.ts` — its 6 cases are UNCHANGED and still pass
  (the extraction preserved behavior).

## The scope fix is self-proving (§1.5.2) — and it was TWO invariants
INVARIANT 8 now scans `(care|coach)/extension/`. The new `coach/extension/refresh/route.ts` has NO
`guardExtensionRequest` — so it is flagged by the widened scan and passes ONLY because it is allowlisted with
its different-auth-model reason. That flag-then-allowlist is the evidence the scan reaches the coach namespace.
INVARIANT 18 (mutation-gate) then flagged the SAME refresh route — its extension-tree `continue` also only
matched `care/extension/`; widening it to `(care|coach)/extension/` cleared it. The same scope-gap lived in
two invariants; both are now fixed. The 5 sales TOOL routes are genuinely covered by INV8 (they pass by using
the guard, not the allowlist).

## Reachability (A31 — assert the seam, and name what is NOT built yet)
```json
[
  {
    "feature": "Sales Coach extension session refresh",
    "files": ["src/lib/api/extensionRefresh.ts", "src/app/api/coach/extension/refresh/route.ts"],
    "write_path": { "exists": true, "where": "POST /api/coach/extension/refresh → refreshExtensionSession → Supabase grant", "human_can_set": "the extension background worker calls it on a 401 — that worker is Phase 2b" },
    "read_path": { "exists": true, "where": "returns {access_token, refresh_token} the worker stores; tested across all branches", "human_can_see": "indirectly — a renewed session keeps tools working; the worker is Phase 2b" }
  }
]
```
The route is complete + tested; its caller (background.js) is honestly Phase 2b, and the README now points it
here.

## Findings
no findings — the extraction preserved the C.A.R.E route (its test unchanged), the widened invariant closes a
real coverage gap (the sales tool routes were unchecked), and the new refresh route follows the same
different-auth-model allowlist pattern as the C.A.R.E one. The connect page + token mint remain the sequenced
deferred piece of the handoff (README), not a silent omission.
