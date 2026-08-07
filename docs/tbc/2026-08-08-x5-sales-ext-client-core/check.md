# CHECK — Sales Coach Extension, Phase 2a: standalone client core

## Verification (A38 — canonical command, by name, coverage + exit)
Ran `npm run check` (typecheck && lint && theme:audit && rls:audit && invariant:audit && tbc && test).

```
invariant:audit — Violations: 0
tbc — docs ✓ · manifest ✓ · artifacts ✓ · residual ✓ · freshness ✓
test — Tests 2402 passed | 15 skipped
=== check exit code: 0 ===
```
New test inside that run:
- `src/lib/coach/extension/__tests__/salesExtensionConfigWiring.test.ts` — 9 cases (4 endpoint→route
  mappings, coach-namespace, + 3 isolation invariants: distinct token / guard / tools-global).

**Scope note (A38 honesty):** `npm run check` covers the config→route wiring and the isolation invariants. It
does NOT — and cannot — exercise the browser runtime (background/content/adapters), which isn't built yet and
has no test harness in a no-browser sandbox. That runtime is Phase 2b, founder-live-verified per platform.

## Reachability (A31 — assert the seam, and name what is NOT built yet)
```json
[
  {
    "feature": "Standalone Sales Coach extension — client core (manifest + wired config)",
    "files": ["extension-sales/manifest.json", "extension-sales/config.js"],
    "write_path": {
      "exists": true,
      "where": "SALES_TOOLS endpoints → the 4 built /api/coach/extension routes; verified by salesExtensionConfigWiring.test.ts",
      "human_can_set": "NOT YET — no panel (content.js) posts these; the rep can't click a tool until Phase 2b"
    },
    "read_path": {
      "exists": false,
      "where": "the panel that renders tool results is not ported yet",
      "human_can_see": "NOT YET — Phase 2b builds content.js"
    }
  }
]
```
**Honest status:** the config↔route seam is verified; the human-facing seam (panel → route → rendered result)
is NOT wired — the runtime is Phase 2b. The package is explicitly NOT loadable. This is a verified scaffold,
not a shippable extension.

## Findings
no findings — the one thing that could silently rot (a tool pointing at a nonexistent route) is guarded, and
the coexistence-with-C.A.R.E invariants are pinned. The deliberate boundary — the whole browser runtime +
auth handoff — is documented in the README status table and Phase 2b spec, not silently omitted. One manual
caution recorded there: the drift guard does NOT catch a missing `refresh` route (there is no tool endpoint
for it), so Phase 2b must not reference `/api/coach/extension/refresh` until it is built.
