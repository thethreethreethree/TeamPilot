# CHECK — Sales Coach Extension: connect handoff

## Verification (A38 — canonical command, gated on the REAL exit)
Ran `npm run check` (typecheck && lint && theme:audit && rls:audit && invariant:audit && tbc && test). The
FIRST run FAILED (exit 1): the env-docs guard caught `NEXT_PUBLIC_SALES_EXTENSION_ID` undocumented — I added
it to `.env.example` and RE-RAN, capturing rc and gating the commit on it:

```
invariant:audit — Violations: 0 (INV9 allowlist now includes NEXT_PUBLIC_SALES_EXTENSION_ID)
tbc — docs ✓ · manifest ✓ · artifacts ✓ · residual ✓ · freshness ✓
test — Tests 2496 passed | 15 skipped
=== check exit code: 0 ===
```
New: `salesExtensionClientWiring.test.ts` connect-handoff block (3 cases) + the pre-existing C.A.R.E connect
route/auth tests are unchanged (default-preserving change).

**Scope (A38 honesty):** the gate covers the static connect↔worker contract + the C.A.R.E non-regression. The
actual browser round-trip (the page calling `chrome.runtime.sendMessage` to the installed extension, the
worker storing the token) is not sandbox-exercisable — founder-confirmed live.

## Reachability (A31 — the Sign-in seam)
```json
[
  {
    "feature": "Sales Coach extension Sign in (connect handoff)",
    "files": ["src/app/extension/connect/page.tsx", "extension-sales/background.js"],
    "write_path": { "exists": true, "where": "panel Sign in → worker open-connect → /extension/connect?product=sales → sends sales-connect to the pinned ext id", "human_can_set": true },
    "read_path": { "exists": true, "where": "worker onMessageExternal('sales-connect') stores the token → badge ✓ → tools authenticate", "human_can_see": "the Connected state + a working panel — the round-trip is founder-live" }
  }
]
```
Both directions exist and match statically (the guard asserts the message types align). The live round-trip is
the founder-confirmed boundary, honestly named.

## Findings
no findings — the connect page is extended product-aware with C.A.R.E byte-for-byte preserved (its tests
unchanged), the token handoff stays pinned per product (security preserved), the new env var is allowlisted +
documented (the env-docs guard enforced it), and the connect↔worker message-type contract is locked by a
test. The first gate failure (undocumented env var) was fixed and the gate re-run to exit 0 before committing —
gated on the real exit, per the discipline re-learned this session.
