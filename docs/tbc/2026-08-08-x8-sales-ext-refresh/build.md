# BUILD — Sales Coach Extension: shared refresh route + detection-scope fix

## Doc integrity (§0.1)
```
$ sha256sum CLAUDE.md ThinkerThinker.md
e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f  CLAUDE.md
0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc  ThinkerThinker.md
```
Match DOC_MANIFEST.json; no governing-doc change, no AMD required.

## Change

### Widen the extension-tree scope in BOTH INVARIANT 8 and INVARIANT 18
`scripts/invariant-audit.mjs`.

- **write-path:** the SAME scope-gap appeared in two invariants. (a) INV8's scan regex becomes
  `^src/app/api/(care|coach)/extension/.*route\.(ts|tsx)$`, so the 5 sales tool routes are now checked for
  `guardExtensionRequest`. (b) INV18 ("mutation route without a recognised auth/tenant gate") delegates
  extension-tree routes to INV8 via a `continue`; its skip regex only matched `care/extension/`, so it flagged
  the new sales refresh route — widened to `(care|coach)/extension/`. The refresh route is added to INV8's
  `EXT_AUTH_ALLOWLIST` with its different-auth-model reason.
- **read-path:** `npm run invariant:audit` now reports across both namespaces (0 violations); the 5 sales
  routes pass by using the guard; the refresh route passes via the INV8 allowlist and the INV18 delegation.

### Shared Supabase-refresh handler (one mechanism)
`src/lib/api/extensionRefresh.ts` (new).

- **write-path:** `refreshExtensionSession(refreshToken)` — env check → Supabase refresh-token grant →
  discriminated result (`ok` + tokens, or `{status, error}` for 500/401/502).
- **read-path:** both refresh routes call it and map the result to a NextResponse; it is unit-tested directly.

### Both refresh routes use the shared handler
`src/app/api/care/extension/refresh/route.ts` (refactor), `src/app/api/coach/extension/refresh/route.ts` (new).

- **write-path:** each route does rateLimit → readBody → `refreshExtensionSession` → NextResponse. The C.A.R.E
  route's behavior is preserved (its 6-case test is unchanged and covered by the run above); the sales route
  mirrors it (id `coach-ext-refresh`).
- **read-path:** the extension calls its route on a 401 to renew the session; returns `{access_token,
  refresh_token}` or the mapped error status.

Also updated (docs, not a code feature): `extension-sales/README.md` — the status table + port plan now show
the refresh route as built (background.js should call it on 401); the connect page + token mint remain the
deferred, specced piece of the handoff.

## Four-layer pre-walk (§1.5.1)
- **L1 structure:** one shared handler, two thin routes; the invariant's scope now matches the routes. Sound.
- **L2 effect:** the shared handler + both routes behave correctly across all branches; tested.
- **L3 continuity:** the refresh route's caller is the (Phase 2b) extension background worker; the README now
  points background.js at it.
- **L4 surface:** none (infra route).

## Verdict: SHIPPABLE
A real detection-scope gap closed + the refresh infra built via one shared mechanism, with the C.A.R.E route
unregressed and the widened scan self-proven.

## Files
- `scripts/invariant-audit.mjs`
- `src/lib/api/extensionRefresh.ts`
- `src/lib/api/__tests__/extensionRefresh.test.ts`
- `src/app/api/care/extension/refresh/route.ts`
- `src/app/api/coach/extension/refresh/route.ts`
- `src/app/api/coach/extension/__tests__/refresh.route.test.ts`
- `extension-sales/README.md`
