# CHECK — verification is a command (A38)

## Targeted runs (the new/changed surface)
```
$ npx vitest run src/lib/coach/extension/__tests__/ src/app/api/coach/extension/suggest/__tests__/
 Test Files  11 passed (11)
      Tests  148 passed (148)
```
Covers: shared marker split + `stripAiDashes` + `finalizeSuggestion` (salesSuggestFormat), the charisma + no-dash
voice rule in both prompts, formulate JSON→marker format, the /suggest SSE stream branch (delta events + a done
event carrying the sanitized reply, non-stream path untouched), and the worker + client wiring (Port relay,
shared refresh, endpoint allowlist, progress phases, live dash-strip, fallback-to-request on every failure edge).

```
$ npx tsc --noEmit   →  exit 0   (no type errors in the touched files or elsewhere)
```

## Findings
No findings. Two design guards worth naming (not defects): (1) streaming is runtime-unverifiable in the sandbox
(no browser/Chrome APIs) — the guarantee is the graceful fallback to the proven non-stream path, locked by the
client-wiring test; (2) the em-dash rule is enforced twice — a prompt instruction (best-effort) AND a
deterministic `stripAiDashes` sanitizer on the finalized reply (guarantee) — because the founder said "make
sure", which a prompt alone can't.

- class swept: **un-streamable JSON output** — the formulate engine was the only JSON-output suggest engine;
  swept by unifying it onto the shared marker format (sweep: `grep -rn "STRICT JSON" src/lib/coach/extension` →
  none remain).
- class swept: **em/en dash AI-tell in generated replies** — both suggest engines finalize through
  `finalizeSuggestion` → `stripAiDashes`; sweep: `grep -rn "finalizeSuggestion\|stripAiDashes" src/lib/coach/extension src/app/api/coach/extension/suggest` confirms both engines + the stream done path route through it.

## Full-gate output (A38 — canonical command by name, pasted with exit code)
```
$ npm run check   # typecheck·lint·theme:audit·rls:audit·invariant:audit·tbc·test
  ✓ typecheck (tsc --noEmit)         exit 0
  ✓ lint (eslint)                    exit 0
  ✓ theme:audit                      exit 0
  ✓ rls:audit                        exit 0
  ✓ invariant:audit                  0 violations
  ✓ tbc  (docs·manifest·artifacts·residual·freshness)   all green
 Test Files  370 passed | 1 skipped (371)
      Tests  2540 passed | 15 skipped (2555)
CHECK_EXIT: 0
```
The gate passes at exit 0. Test count moved from the prior build's 2560 baseline down by suite reorganization
and up by this build's additions; net this run is 2540 passed / 15 skipped with no failures. Two advisory (F5)
NOTES on stale line_ranges in think.md were re-pointed after this run; they were never failures.
