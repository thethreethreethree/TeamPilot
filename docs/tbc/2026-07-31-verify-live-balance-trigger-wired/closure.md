# CLOSURE — verify:live H3 balance trigger-wired assertion

## What shipped

`verify:live`'s H3 check now asserts the double-entry balance enforcement is WIRED — the two DEFERRABLE
CONSTRAINT triggers (`fin_assert_balanced_from_entry` on `fin_journal_entries`, `fin_assert_balanced` on
`fin_journal_lines`) that fire on INSERT at commit — not merely that the balance CHECKER function exists.
A dropped balance trigger would otherwise let an unbalanced entry post while the guard stayed green.

**This corrects the prior build's claim.** The 2026-07-31 finance-immutability closure asserted the
fn-checked-not-trigger class was COMPLETE because "`fin_assert_entry_balanced` is explicit-call, no
trigger." That was a §0 miss: I matched one function name and stopped. Balance IS trigger-enforced, by
differently-named functions. With this build the class is NOW genuinely complete for verify:live's three
trigger-enforced thesis/money checks: §3.2 gate, H2 immutability, H3 balance — each asserts its trigger is
wired, verified this time against a FULL census of guarantee-enforcing triggers, not a single-name guess.

## What I relied on that is NOT self-evident (the un-named-reliance half)

- **The full trigger census** (dozens of guarantee-enforcing triggers exist) is what lets me claim "class
  complete" honestly THIS time — the claim rests on having enumerated them, not on a lucky match.
- **verify:live is selective by design:** the dozens of OTHER guarantee triggers (care/chat immutability,
  fin_freeze_creator ×15, approval limits, expense policy) are intentionally NOT live-checked. Whether any
  deserve promotion to a standing verify:live invariant is a founder scope call — surfaced, not decided.

## Residual (A36)

```json
[
  {
    "id": "RES-01",
    "item": "verify:live guards ~4 of the dozens of DB guarantee-enforcing triggers (the thesis/money-critical set). The rest (care/chat immutability, fin_freeze_creator across ~15 tables, approval-limit + expense-policy triggers) have no standing live-check.",
    "why_skipped": "verify:live is deliberately selective — a curated set of the highest-value invariants, not an exhaustive trigger mirror. Promoting more of them to standing checks is a scope/priority decision that is the founder's, and each addition costs a live query per run.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-07-31T12:18:00Z",
    "outcome": "OPENED + surfaced as a founder scope question (which guarantees warrant a standing live-check), NOT auto-expanded. The trigger-wiring correctness of the checks verify:live ALREADY has is now complete; broadening the SET is separate."
  },
  {
    "id": "RES-02",
    "item": "The trigger-wired checks (§3.2, H2, H3) do not assert the trigger is ENABLED (tgenabled <> 'D').",
    "why_skipped": "DISABLE TRIGGER is a deliberate admin action, not a migration-drift accident; the dominant dropped/narrowed failure mode is covered for all three. Consistent judgment across the three builds.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-07-31T12:18:00Z",
    "outcome": "OPENED + judged low-value; a single tgenabled clause on all three would close it if ever warranted."
  }
]
```

## Verification

verify:live 18/18 + detection test (see check.md), exit 0. Full `npm run check` is the CI gate.
