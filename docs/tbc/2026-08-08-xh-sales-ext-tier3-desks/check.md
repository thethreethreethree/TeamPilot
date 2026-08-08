# CHECK — verification is a command (A38)

## Targeted run (the routing tests, executed this session)
```
npx vitest run src/lib/coach/extension/__tests__/salesExtensionClientWiring.test.ts
  → Test Files 1 passed (1);  Tests 47 passed (47);  EXIT: 0
```
Was 42 → 47: +1 Tier-3 coverage assertion, +4 execution-routing rows (incl. the `acme.zendesk.com`→zendesk and
`shop.gorgias.com`→gorgias subdomain cases that exercise the `.endsWith()` predicates). The vm loads the real
`adapters.js` and asserts `salesAdapterFor(host).key`, so a typo'd `match` would fail here — not a tautology.

## Verification findings
The check phase surfaced **no findings** (no defects, no regressions). Re-confirmed:
- No manifest change was needed or made — the adapters inject via `activeTab`; `host_permissions` stays the two
  API origins. (Verified: Tier-1/2 sites aren't in host_permissions either.)
- `content.js` unchanged — the new keys route through the existing `captureConversation` path + the xg preview.
- Drift-sync complete — grep confirms no stale "13 platforms" reference remains across the extension + docs.
- Text-only posture preserved — no `rcdOrText`/media helper leaked in from the C.A.R.E copy (asserted by the
  existing "dropped the C.A.R.E RCD/media helpers" test, still passing).

## Full-gate output (A38 — pasted, with exit code)
```
$ npm run check   # tbc:docs·manifest·artifacts·residual·freshness · typecheck·lint·theme:audit·rls:audit·invariant:audit·test
 Test Files  371 passed | 1 skipped (372)
      Tests  2535 passed | 15 skipped (2550)
EXIT: 0
```
All eleven gates pass, exit 0. The full suite is green with the four adapters + their routing tests in place.
