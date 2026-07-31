# CHECK — verify:live view-invoker guard

## Audit of the build

- **Only tightens:** a new independent check; it can only ADD a failure (a non-invoker view), never mask an
  existing one.
- **Correct predicate:** matches BOTH `security_invoker=on` (Postgres's storage) and `=true` (migration
  text) — the exact bug (matching only `true`) that caused the false finding is now impossible.
- **Allowlist-free + honest:** 0 offenders live, verified with the corrected predicate; a real drift makes it
  fail loudly with the view name.
- **Read-only:** catalog query, no mutation.

## Findings

**No findings.** The guard passes on the healthy live DB and is detection-proven to flag a non-invoker view.

## Verification (canonical command + predicate detection test)

`npm run verify:live` — **all 19 invariants hold**, including the new view guard:

```
  ✓ PASS  no public VIEW bypasses RLS (every view is security_invoker on|true) — LIVE complement to rls:audit's migration-text parse  — all public views are security_invoker (RLS applies as the caller)
  ...
✅ ALL 19 invariants hold.
EXIT=0
```

Predicate detection test (proves it accepts the safe forms + flags the unsafe ones):

```
predicate: security_invoker=on flagged? false (want false)
predicate: security_invoker=true flagged? false (want false)
predicate: no-option flagged? true (want TRUE — would catch a bypass)
predicate: security_barrier-only flagged? true (want TRUE — barrier≠invoker)
```

So the guard passes for real invoker-safe views (both `on` and `true`), and would FAIL (flag) a view with no
`security_invoker` option or only `security_barrier` — the real RLS-bypass drift is now caught in CI.
