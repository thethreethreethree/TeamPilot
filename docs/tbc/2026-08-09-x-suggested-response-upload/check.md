# CHECK — verification is a command (A38)

## Targeted runs (the new/changed surface)
```
npx vitest run src/app/api/coach/extension/suggest src/app/api/coach/extension/extract \
  src/lib/coach/extension/__tests__/salesExtension{Config,Client,Background}Wiring.test.ts
 → Test Files passing; suggest dispatch (guidance→formulate, none→copilot), extract validation
   (gate/400/415/200), config/client/background wiring all green.
```

## Findings
No findings after two fixes surfaced BY the gate (not asserted around): (1) config-wiring "input-bearing tools
≥ 2" → now 1 post-merge (updated + reworded); (2) invariant-audit INV5 flagged /extract for not running
`validateUploadCandidate` — resolved per A28 by allowlisting it with the SAME "extract-to-memory, never
stored/served, strict extension allowlist + size cap" reasoning as its sibling `sales-session/extract`, not by
bolting on a validator the sibling doesn't use. Also a strict-null TS error in the suggest test (optional-chained).

## Full-gate output (A38 — canonical command by name, pasted with exit code)
```
$ npm run check   # typecheck·lint·theme:audit·rls:audit·invariant:audit·tbc·test
  Files scanned: 768 · Documented exceptions: 38 · Violations: 0   (invariant:audit)
 Test Files  375 passed | 1 skipped (376)
      Tests  2560 passed | 15 skipped (2575)
EXIT: 0
```
All gates pass, exit 0. Test count 2549 → 2560 (+11: suggest 4, extract 4, background +3 assertions folded into
existing files, client-wiring +1 assertion). Client (content.js/background.js) is RUNTIME-UNVERIFIED here (no
browser) — locked by source-wiring tests; live behavior is the founder's confirm (established extension posture).
