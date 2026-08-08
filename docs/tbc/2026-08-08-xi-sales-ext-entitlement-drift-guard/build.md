# BUILD — entitlement-gating drift guard

### security drift guard (every route gated or ungated-by-design)
- **write-path:** `src/lib/coach/extension/__tests__/salesExtensionConfigWiring.test.ts` — a new `describe`
  block after the reverse-drift (orphan-route) guard.
- **read-path:** `npm run test` (vitest) — `readdirSync` the coach/extension routes, `readFileSync` each
  `route.ts`, assert `guardExtensionRequest` present OR the dir is in `UNGATED_BY_DESIGN`.
- **what:** `it.each(routeDirs)` asserts `src.includes("guardExtensionRequest") || UNGATED_BY_DESIGN.has(dir)`.
  `UNGATED_BY_DESIGN = new Set(["refresh"])` with the documented reason (refresh is unauthenticated by design —
  the refresh_token is the credential).
- **why (A30):** the per-route 402 tests lock TODAY's routes; this locks the NEXT one. A new tool route added
  without the gate = anyone with a valid Supabase token, entitled or not, burns the paid AI tools. Prose
  ("remember to gate new routes") is not a gate.

### detection proof (not a tautology)
- **write-path:** none — a verification step, recorded in check.md/think.md.
- **read-path:** `grep -c guardExtensionRequest src/app/api/coach/extension/refresh/route.ts` → `0`.
- **what:** refresh contains the guard string zero times, so the `UNGATED_BY_DESIGN` exemption is load-bearing —
  remove it and the assertion fails on refresh. That demonstrates the guard fails an ungated route, so it is a
  real detection guard, not an assertion that can only pass.
- **why:** an audit that can't fail is theatre; A30's false-positive-constraint sibling requires the guard
  actually discriminate.
