# CHECK - INVARIANT 26, the Bearer/cookie-client guard

## Canonical commands
```
$ TBC_BUILD=2026-09-05-bearer-cookie-invariant npm run check
  typecheck . lint . theme:audit . rls:audit . invariant:audit . tbc . test
  invariant audit: 997 files scanned, 0 violations (INVARIANT 26 included)
  tbc: docs, manifest, artifacts, residual, freshness -- five of five clean
  Test Files  623 passed | 1 skipped (624)
       Tests  4106 passed | 15 skipped (4121)
EXIT_CHECK=0
```

## The guard FIRES (mutation, A38)
A guard that exists but never matches reads as protection while protecting nothing,
so it was proven against the real defect it was written for:

```
$ (mutate) remove "src/lib/coach/v5/memory.ts" from INV26_ALLOWLIST
$ node scripts/invariant-audit.mjs
  Violations:           1
  ✗ Bearer-authenticated route reaches a library that resolves its own COOKIE client
      src/app/api/care/extension/coach/route.ts
$ (restore)
  Violations:           0
```

It named the exact route that carried the bug. The mutation was confirmed APPLIED
before the result was read - an earlier attempt failed to apply because of shell
quoting, and restoring from a backup taken BEFORE the insertion silently removed the
whole invariant. Both were caught by checking, not by assuming.

## Findings

### F1 - a class recurred four times because every sweep was one hop deep

class: reachability analysis that reads a route's direct imports and stops.
sweep: `node scripts/invariant-audit.mjs` now performs the transitive walk on every
  run; no hand sweep is required and none should be trusted over it.
severity: high - it produced two confident wrong answers to the founder (roleplay
  recorded as a separate Anthropic problem; the residual declaring the remaining
  modules unreachable), and the second one hid a live defect for a further day.

### F2 - the first run of this very analysis was circular

class: a heuristic that includes the thing it is testing for.
sweep: for each helper named in a detector's regex, open it and confirm it does what
  the regex claims. `careAgentAuth` does not resolve a Bearer token.
severity: high as a method fault, zero as a code fault - it would have produced 37
  false reports. Now encoded as a named self-test.

### F3 - the guard cannot see a runtime-only path

class: a route that reaches a cookie library through something the import graph
  cannot follow - a dynamic import, a string-keyed dispatch table, an injected
  dependency.
sweep: `grep -rn "await import(" src/app/api src/lib --include=*.ts` for the dynamic
  case; the injected case is invisible by construction.
severity: medium and DECLARED. This is a static guard and it does not claim
  otherwise. It closes the shape that caused all four incidents; it does not close
  every conceivable shape.
