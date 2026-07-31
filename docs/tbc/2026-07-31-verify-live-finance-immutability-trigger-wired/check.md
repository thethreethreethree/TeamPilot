# CHECK — verify:live H2 finance-immutability trigger-wired assertion

## Audit of the build

- **Only tightens:** ANDs two conditions into an existing pass predicate — can only make H2 FAIL when an
  immutability trigger is un-wired; never masks a regression.
- **Precise:** matches the specific fn on the specific table with the mutation-blocking event bits
  (UPDATE+DELETE), so it catches the exact bypass (trigger dropped or narrowed away from UPDATE/DELETE).
- **Scope-correct:** `fin_assert_entry_balanced` is left at fn-exists level because it is an explicit-call
  function (no trigger), confirmed live — so the balance check is not falsely extended.
- **Read-only:** catalog query, no mutation.

## Findings

**No findings.** The strengthened H2 passes on the healthy live DB and is detection-proven to fail on the
un-wired-trigger scenario.

## Verification (canonical command + detection test)

`npm run verify:live` — **all 18 invariants hold**, including the strengthened H2 line:

```
  ✓ PASS  H2 finance immutability (fin_entries_immutable + fin_lines_immutable fns + triggers WIRED)
  ...
✅ ALL 18 invariants hold.
EXIT=0
```

Detection test of the trigger-wired queries against the live DB (proves discrimination):

```
entries trigger WIRED (BEFORE UPD+DEL): ✓ passes
lines trigger WIRED (BEFORE UPD+DEL): ✓ passes
DETECTION (demand STATEMENT bit these ROW triggers lack): ✓ correctly 0 (discriminates)
```

So H2 passes for the real wired triggers, and would return 0 (→ the invariant FAILS) if the immutability
trigger were dropped or narrowed — the silent-mutation bypass is now caught.
