# BUILD — Sales Coach Extension, Phase 2a: standalone client core

## Doc integrity (§0.1)
```
$ sha256sum CLAUDE.md ThinkerThinker.md
e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f  CLAUDE.md
0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc  ThinkerThinker.md
```
Match DOC_MANIFEST.json; no governing-doc change, no AMD required.

## Change

### Standalone extension manifest + wired config
`extension-sales/manifest.json`, `extension-sales/config.js` (new).

- **write-path:** `config.js` publishes `SALES_TOOLS` (Catch me up / Read the room / Coach my reply / Draft
  my reply) each with an `endpoint` under `/api/coach/extension/`, plus `getApiBase`/`getToken` reading a
  DISTINCT `salesCoachToken` key behind a DISTINCT `__salesCoachConfigLoaded` guard. `manifest.json` is MV3,
  sales-branded, same host permissions as the C.A.R.E extension.
- **read-path:** NOT YET — the panel (`content.js`) that renders from `SALES_TOOLS` and posts to each
  `endpoint` is Phase 2b (specced in the README), deliberately not built here. The config values ARE read
  in-sandbox by the drift guard, which is the only read this phase claims.

### Drift guard: every tool endpoint maps to a built route
`src/lib/coach/extension/__tests__/salesExtensionConfigWiring.test.ts` (new).

- **write-path:** reads `extension-sales/config.js`, extracts each `endpoint`, and asserts a matching
  `src/app/api/.../route.ts` exists; also asserts the coach namespace + the three isolation invariants
  (distinct token/guard/tools names).
- **read-path:** runs inside `npm run check`; a tool pointing at a missing route fails the gate.

Also added (a doc, not a code feature): `extension-sales/README.md` — an honest status table (built vs
not-yet-ported), an explicit "NOT yet loadable", and a mechanical, well-scoped Phase 2b port plan for
background/content/adapters/permission/icons + the auth (connect/refresh) dependency.

## Four-layer pre-walk (§1.5.1)
- **L1 structure:** a clean standalone package dir mirroring `../extension`; distinct keys so it coexists.
  Sound.
- **L2 effect:** the config→route contract is verified by the drift guard; the browser runtime is NOT
  exercisable here and is deferred. Partial by design, honestly bounded.
- **L3 continuity:** N/A until the runtime + auth handoff exist (Phase 2b) — specced, not stubbed.
- **L4 surface:** the tool labels/descriptions the rep will see are set; the panel that renders them is
  Phase 2b.

## Verdict: SHIPPABLE-WITH-FOLLOWUP
The verifiable, sales-specific core ships with a guard binding it to the real routes; the unverifiable runtime
is precisely specced for Phase 2b. Honestly labeled NOT-yet-loadable — not a faked working extension.

## Files
- `extension-sales/manifest.json`
- `extension-sales/config.js`
- `extension-sales/README.md`
- `src/lib/coach/extension/__tests__/salesExtensionConfigWiring.test.ts`
