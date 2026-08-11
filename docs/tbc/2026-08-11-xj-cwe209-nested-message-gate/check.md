# CHECK — CWE-209 nested-.message gate

## Verification run (A38 — canonical command + exit code)
```
$ npm run invariant:audit
  Violations:           0
INV_EXIT=0
$ npx vitest run "scripts/__tests__/invariant-audit"
 Test Files  1 passed (1)
      Tests  26 passed (26)
VITEST_EXIT=0
$ npm run check
  Violations: 0
 Test Files  391 passed | 1 skipped (392)
      Tests  2685 passed | 15 skipped (2700)
CHECK_EXIT=0
```
The widened regex is 0-violations on the current tree (regression guard, not a new-finding gate). The new
detection block asserts the nested `fc.error.message` shape MATCHES (it previously slipped) and the four
controlled shapes do NOT, and binds the widening to the script text.

## Proactive scan (§1.5.2) — did widening introduce a false positive anywhere?
The invariant audit runs across every `route.ts` (~640 files) and returned 0 violations, so no controlled site
in the current tree matches the widened pattern. The detection-test's negative cases (`auth.error`,
`result.error`, Zod issues, string literal) confirm the shape stays narrow.

## Findings
**No findings.** This is a gate-hardening build: it closes the A30 gate xi left A33-deferred for the narrow,
non-ambiguous nested-`.message` form. The broader `{ error: X.error }` non-`.message` field widening remains
correctly A33-deferred (it needs cross-file raw-vs-curated analysis a route-level regex can't do) — carried in
the residual.
