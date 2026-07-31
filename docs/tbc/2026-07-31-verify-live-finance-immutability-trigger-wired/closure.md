# CLOSURE — verify:live H2 finance-immutability trigger-wired assertion

## What shipped

`verify:live`'s H2 check now asserts the finance-immutability enforcement is WIRED (BEFORE UPDATE+DELETE
triggers running `fin_entries_immutable` / `fin_lines_immutable` on `fin_journal_entries` /
`fin_journal_lines`), not merely that the functions exist. This closes the finance half of the
fn-checked-not-trigger class the §3.2 build opened — a dropped immutability trigger would otherwise let a
posted journal entry/line be silently mutated while the guard reported healthy.

With this, the "guard verifies a fn but not that its trigger is wired" class is COMPLETE across
verify:live: §3.2 understanding gate (prior build) + H2 finance immutability (this build). `fin_assert_entry_balanced`
(H3) is confirmed explicit-call, not trigger-enforced, so its fn-exists+raises check is already the
correct level — nothing to wire there.

## What I relied on that is NOT self-evident (the un-named-reliance half)

- **The trigger + table NAMES** (`fin_entries_immutable_trg` on `fin_journal_entries`, etc.) are the live
  names this session. A rename migration would (correctly) fail H2 until the query is updated — the safe
  direction.
- **The event-bit choice (UPDATE+DELETE, not INSERT):** immutability blocks mutation/deletion of posted
  rows; INSERT is how they are created (allowed). The live triggers also fire on INSERT, but asserting
  INSERT would be wrong (the guarantee is UPDATE/DELETE-blocking). Verified the bits against the live
  trigger def before choosing.

## Residual (A36)

```json
[
  {
    "id": "RES-01",
    "item": "Neither the §3.2 nor the H2 trigger check asserts the trigger is ENABLED (tgenabled <> 'D') — a present-but-disabled trigger would pass.",
    "why_skipped": "DISABLE TRIGGER is a deliberate admin action, not a migration-drift accident; the dominant failure mode (dropped/narrowed by a migration) is now covered for both. Same judgment recorded in the §3.2 build's residual.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-07-31T12:03:00Z",
    "outcome": "OPENED + judged low-value (consistent with the §3.2 build). A single `and tg.tgenabled <> 'D'` clause on both checks would close it if ever warranted; named so the boundary stays explicit."
  },
  {
    "id": "RES-02",
    "item": "The fn-checked-not-trigger class is now swept across verify:live's trigger-enforced checks (§3.2 gate, H2 immutability); other checks assert rules (append-only) or policies (RLS) which have their own existence+behavioral checks.",
    "why_skipped": "No other verify:live check was found to assert a trigger-backed guarantee via fn-existence alone — the class is bounded and now closed. Append-only is rule-based (already has a behavioral no-op check); RLS is policy-based (already has permissive-policy checks).",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-07-31T12:03:00Z",
    "outcome": "OPENED + confirmed the class is complete — this was the last trigger-enforced guarantee checked by fn-existence. Nothing further of this class remains."
  }
]
```

## Verification

verify:live 18/18 + detection test (see check.md), exit 0. Full `npm run check` is the CI gate.
