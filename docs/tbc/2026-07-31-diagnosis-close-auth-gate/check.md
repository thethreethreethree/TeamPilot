# CHECK — auth gate on diagnosis/close

## Audit of the build (did the fix itself introduce a defect?)

- **No-op for the real caller (§1.5):** the only non-test caller is the authenticated
  `dashboard/diagnose` page, so the 401 branch is unreachable in the real flow. No workflow breaks.
- **Fails closed, not open:** the gate returns 401 on a missing user (the safe direction); it does
  not widen access.
- **Client hoist is behaviour-preserving:** `createClient()` moved above the try; the RPC still runs
  on the same client. Typecheck of the changed file is clean (no errors reported for
  `diagnosis/close`).
- **CWE-209 unaffected:** the existing generic-error branches (RPC-error + catch) are untouched and
  still covered by their tests.

## Findings

**No findings.** The gate is the minimal sibling-parity change, the detection test proves the anon
path is closed without reaching the RPC, and the happy/validation/CWE-209 paths are unchanged and
still green.

## Verification (canonical command)

The route test suite passes — 6-of-6, including the new anon-401 detection case — at **exit code 0**:

```
$ npx vitest run src/app/api/diagnosis/close/__tests__/route.test.ts
 Test Files  1 passed (1)
      Tests  6 passed (6)
EXIT_CODE=0
```

The new test is a genuine detection test: it stubs `auth.getUser()` to return `{ user: null }` and
asserts both `status === 401` AND that `close_problem` was never called (`rpcCalled === false`).
Remove the gate and the route would return 200 with the RPC invoked → the test fails on both
assertions.
