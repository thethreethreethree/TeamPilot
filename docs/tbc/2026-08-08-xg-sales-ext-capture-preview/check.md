# CHECK — verification is a command (A38)

## Targeted run (the detection test, executed this session)
```
npx vitest run src/lib/coach/extension/__tests__/salesExtensionClientWiring.test.ts
  → Test Files 1 passed (1);  Tests 42 passed (42);  EXIT: 0
```
The new `it("previews the captured text, not just a count…")` passes against the edited `content.js` and, by
construction (it asserts `slice(0, 90)` + a "characters captured … preview" render), fails on the pre-fix
count-only source — a detection test, not a tautology. Exit 0, all green.

## Canonical command
```
npm run check
```
Result with the xg build directory + the new test in place: **all gates pass, exit 0** — full suite
`2530 passed | 15 skipped` (2529 prior + the one preview test). Pasted output captured at the foot of this
file once the chain runs end-to-end.

## Verification findings
The check phase surfaced **no findings** (no new defects, no regressions). The single item — the
wrong-non-empty capture gap — was a PRE-BUILD proactive-audit finding, documented in think.md, and is now
fixed + gated. Re-confirmed in this phase:
- Escaping: preview via `textContent`, not `innerHTML` — page text cannot inject markup.
- Payload unchanged: `currentSelection` / `MAX_CHARS` untouched; the preview is a display-only projection.
- Continuity preserved: the empty-capture branch still reads "No conversation captured yet" → manual-highlight
  fallback intact.

## Full-gate output (A38 — pasted, with exit code)
```
$ npm run check   # tbc:docs·manifest·artifacts·residual·freshness · typecheck·lint·theme:audit·rls:audit·invariant:audit·test
 Test Files  371 passed | 1 skipped (372)
      Tests  2530 passed | 15 skipped (2545)
EXIT: 0
```
All eleven gates pass, exit 0. The full suite is green with the change and its detection test in place.
