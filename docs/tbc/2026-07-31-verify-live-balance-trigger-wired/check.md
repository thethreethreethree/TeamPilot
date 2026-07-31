# CHECK — verify:live H3 balance trigger-wired assertion

## Audit of the build

- **Only tightens:** ANDs conditions into an existing predicate — can only make H3 FAIL when a balance
  trigger is un-wired; never masks a regression.
- **Correct fn/table pairing:** matched to the ENUMERATED live triggers (not guessed) —
  `fin_assert_balanced_from_entry`↔`fin_journal_entries`, `fin_assert_balanced`↔`fin_journal_lines`.
- **Event choice:** INSERT (bit 4) is the balance-critical event (a new entry must balance); the triggers
  are AFTER/deferred constraint triggers, so BEFORE is (correctly) not asserted.
- **Read-only:** catalog query, no mutation.

## Findings

**No findings** in the build. The correction of the prior premature "class complete" claim is recorded in
think.md section 2 and closure — the honest outcome of re-checking a too-quick conclusion (§5).

## Verification (canonical command + detection test)

`npm run verify:live` — **all 18 invariants hold**, including the strengthened H3 line:

```
  ✓ PASS  H3 finance double-entry balance (fn raises + both balance triggers WIRED on the journal tables)
  ...
✅ ALL 18 invariants hold.
EXIT=0
```

Detection test of the balance trigger-wired queries against the live DB:

```
entry balance trigger WIRED (INSERT): ✓
lines balance trigger WIRED (INSERT): ✓
DETECTION (wrong fn name): ✓ correctly 0
```

So H3 passes for the real wired balance triggers, and returns 0 (→ the invariant FAILS) if a balance
trigger fn/table is wrong or the trigger is dropped — the unbalanced-post bypass is now caught.
