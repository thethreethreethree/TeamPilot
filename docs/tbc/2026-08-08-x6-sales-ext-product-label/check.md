# CHECK — Sales Coach Extension: product label in the entitlement 402

## Verification (A38 — canonical command, by name, coverage + exit)
Ran `npm run check` (typecheck && lint && theme:audit && rls:audit && invariant:audit && tbc && test).

```
invariant:audit — Violations: 0 (incl. "every extension route authenticated")
tbc — docs ✓ · manifest ✓ · artifacts ✓ · residual ✓ · freshness ✓
test — Tests 2405 passed | 15 skipped
=== check exit code: 0 ===
```
Focused run first (auth + all extension routes, C.A.R.E and sales): 13 files, 92 passed. New cases:
- `extensionAuth.test.ts` — default→C.A.R.E string (unchanged), sales label→Sales Coach string + no C.A.R.E
  leak, not-included variant.

## Ripple check (§1.5 — shared code, 8 C.A.R.E callers)
The C.A.R.E extension route tests (dissect/coach/summarize/copilot/formulate/spawn/rcd/refresh) and the
pre-existing auth cases are unaffected — the `productLabel` default reproduces the original strings exactly.
Only the 4 sales routes opt into the new label. (The run above covers all of them.)

## Reachability (A31 — both directions)
```json
[
  {
    "feature": "Correct product label in the entitlement 402",
    "files": ["src/lib/api/extensionAuth.ts", "src/lib/api/extensionGuard.ts", "src/app/api/coach/extension/*/route.ts"],
    "write_path": { "exists": true, "where": "sales routes pass productLabel:'Sales Coach extension' → requireEntitledExtensionUser interpolates it", "human_can_set": true },
    "read_path": { "exists": true, "where": "402 response body error string, read by the extension client + asserted by the auth test", "human_can_see": true }
  }
]
```
Both directions exist: the sales routes set the label, and a locked user sees it in the 402 body. (When the
sales client renders 402s in Phase 2b, this string is what it shows.)

## Findings
no findings — the change is a default-preserving optional parameter; every C.A.R.E caller is unchanged
(their route tests are unaffected) and only the sales surface's copy is corrected. The entitlement SOURCE
decision (shared vs separate SKU) is explicitly scoped out to the founder, not guessed — recorded in closure
residual.
