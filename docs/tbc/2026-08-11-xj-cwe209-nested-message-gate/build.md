# BUILD — CWE-209 nested-.message gate

### Invariant 14 regex catches nested raw .message (`scripts/invariant-audit.mjs:698`)
- write-path: `RAW_ERR_MSG_RE`'s direct alternative changes from `[ident]\.message` to
  `[ident](?:\.[ident])?\.message` — an optional intermediate property — so `error: fc.error.message` is
  detected, not just `error: err.message`. The interpolated + instanceof alternatives are unchanged (the
  interpolated one already allowed nested access via `[^}]*`). The `kind:` / `status 400-429` exclusions and the
  allowlist are unchanged.
- read-path: `npm run invariant:audit` scans every `route.ts` and reports the CWE-209 rule; a nested-`.message`
  leak at a 5xx now surfaces as a violation. Verified 0 violations on the current tree (the one nested site,
  finance/forecast, was fixed in xi).

### Permanent detection-test for invariant 14 (`scripts/__tests__/invariant-audit.test.ts`)
- write-path: a new `it(...)` re-declares the widened regex and asserts LEAK shapes match (nested, direct,
  interpolated, catch-fallback) while CONTROLLED shapes don't (`auth.error`, `result.error`, Zod
  `issues[0]?.message`, string literals); plus `expect(SCRIPT).toContain(<nested-access group>)` so the
  widening can't be silently reverted while the test still passes on its own copy.
- read-path: `npx vitest run scripts/__tests__/invariant-audit` — the block fails if the detector is narrowed
  or the script reverted. Invariant 14 previously had NO detection-test; it does now.
