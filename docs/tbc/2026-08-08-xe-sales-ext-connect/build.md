# BUILD — Sales Coach Extension: connect handoff (Sign in end-to-end)

## Doc integrity (§0.1)
```
$ sha256sum CLAUDE.md ThinkerThinker.md
e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f  CLAUDE.md
0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc  ThinkerThinker.md
```
Match DOC_MANIFEST.json; no governing-doc change, no AMD required.

## Change

### Product-aware connect page (serves both extensions)
`src/app/extension/connect/page.tsx`.

- **write-path:** reads `?product` (default "care"). Sales → hands off with message type `sales-connect`,
  pins to `NEXT_PUBLIC_SALES_EXTENSION_ID`, labels the UI "Sales Coach", and preserves `product` through the
  login redirect. No `product` → the original C.A.R.E path unchanged (`care-connect`, C.A.R.E env, C.A.R.E
  labels). Reuses `isExtensionHandoffAllowed` for the per-product pin.
- **read-path:** the extension's worker receives the pinned handoff and stores the token; the page shows a
  Connected state (or a copy-token fallback). C.A.R.E readers see no change.

### The new env var — allowlisted + documented
`scripts/invariant-audit.mjs` (INV9 allowlist), `.env.example`.

- **write-path:** `NEXT_PUBLIC_SALES_EXTENSION_ID` added to the INV9 NEXT_PUBLIC allowlist (a public extension
  id, safe to expose) and to `.env.example` (a commented line — the env-docs guard requires it).
- **read-path:** deployers set it to the official sales extension id in prod to pin the handoff.

### Cross-artifact guard: connect ↔ worker message type
`src/lib/coach/extension/__tests__/salesExtensionClientWiring.test.ts` (+3 cases).

- **write-path:** asserts the connect page emits `sales-connect`, the worker listens for exactly
  `sales-connect`, C.A.R.E's `care-connect` default is preserved, and the worker opens `?product=sales`.
- **read-path:** runs in `npm run check`; a drift between the page's connect type and the worker's listener
  (which would silently break Sign in) fails the gate.

## Four-layer pre-walk (§1.5.1)
- **L1 structure:** one product-parameterized page, default-preserving; reuses the pin helper. Sound.
- **L2 effect:** the sales branch emits the right message type to the right pinned id; the C.A.R.E branch is
  unchanged. The Chrome round-trip is founder-live.
- **L3 continuity:** completes the arc — panel Sign in → open-connect → connect page → token to worker →
  Connected. The rep is left flowing (close tab, use the tools).
- **L4 surface:** the page shows a product-labeled Connected state + a manual-token fallback.

## Verdict: SHIPPABLE
The last piece for a working extension: Sign in now works end-to-end, via one product-aware connect page with
C.A.R.E preserved and the handoff pinned per product. The browser round-trip is founder-confirmed live.

## Files
- `src/app/extension/connect/page.tsx`
- `scripts/invariant-audit.mjs`
- `.env.example`
- `src/lib/coach/extension/__tests__/salesExtensionClientWiring.test.ts`
