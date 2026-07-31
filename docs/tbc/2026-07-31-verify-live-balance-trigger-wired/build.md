# BUILD — verify:live H3 balance trigger-wired assertion

### H3 double-entry balance trigger-wired check

Strengthened the existing `verify:live` H3 check in `scripts/verify-invariants-live.mjs`.

- **write-path:** the check now computes two additional booleans — `trigEntry` / `trigLines` — each a
  live catalog query asserting the balance trigger fn is wired on its journal table
  (`fin_assert_balanced_from_entry` on `fin_journal_entries`, `fin_assert_balanced` on
  `fin_journal_lines`) firing on INSERT (`(tgtype & 4)=4`) — and ANDs them into the pass condition
  (`bal && trigEntry && trigLines`). A dropped balance trigger → false → the check FAILS.
- **read-path:** `npm run verify:live` prints
  `✓ PASS H3 finance double-entry balance (fn raises + both balance triggers WIRED on the journal tables)`
  when healthy; a failure names H3 so the operator sees the double-entry guarantee lapsed.

Files:
- `scripts/verify-invariants-live.mjs` — extended H3 with the two balance-trigger-wired assertions + a
  comment recording that balance is enforced by DEFERRABLE CONSTRAINT triggers and the bypass this closes.
