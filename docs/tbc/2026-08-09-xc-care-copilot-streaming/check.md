# CHECK — verification is a command (A38)

## Targeted runs (the new/changed surface)
```
$ npx vitest run src/app/api/care/extension/__tests__/copilot.route.test.ts src/lib/care/__tests__/extensionWorker.test.ts
 Test Files  2 passed (2)
      Tests  21 passed (21)
```
Covers: the C.A.R.E copilot SSE stream branch (delta events + a done event with the marker-split reply,
non-stream engine NOT called), and the worker/client wiring (Port `care-copilot-stream`, shared
`refreshCareAccessToken`, endpoint allowlist on the port, `runCopilotStreaming` + progress + fallback).

```
$ npx tsc --noEmit   →  exit 0
```

## Findings
No findings. One fixed during the run (surfaced by the gate, not asserted around): the vm-loaded worker test
threw because the mocked `chrome.runtime` lacked `onConnect` for the new listener — added `onConnect: noop` to
the mock. Class note: this is a PURE DELIVERY mirror — the C.A.R.E co-pilot prompt and output are byte-unchanged;
only the transport streams. No sales charisma / dash sanitizer was imported (founder constraint), verified by
sweep: `grep -rn "salesVoiceRule\|stripAiDashes\|charisma" extension/ src/app/api/care/extension/copilot` →
none.

## Full-gate output (A38 — canonical command by name, pasted with exit code)
```
$ npm run check   # typecheck·lint·theme:audit·rls:audit·invariant:audit·tbc·test
  ✓ typecheck · lint · theme:audit · rls:audit          exit 0
  ✓ invariant:audit                                     0 violations
  ✓ tbc  (docs·manifest·artifacts·residual·freshness)   all green
 Test Files  370 passed | 1 skipped (371)
      Tests  2545 passed | 15 skipped (2560)
CHECK_EXIT: 0
```
The gate passes at exit 0. One manifest fix during the run: two `why_it_governs` entries (§6, A19) were too
terse and were expanded to real reasons (not title restatements) — never a code failure.
