# BUILD — verify:live H2 finance-immutability trigger-wired assertion

### H2 finance-immutability trigger-wired check

Strengthened the existing `verify:live` H2 check in `scripts/verify-invariants-live.mjs`.

- **write-path:** the check now computes two additional booleans — `trigEntry` / `trigLines` — each a
  live catalog query asserting the immutability fn is wired as a non-internal trigger on its table
  (`fin_journal_entries` / `fin_journal_lines`) firing BEFORE, on UPDATE and DELETE
  (`(tgtype & 2)=2 and (tgtype & 8)=8 and (tgtype & 16)=16`) — and ANDs them into the pass condition
  (`immEntry && immLines && trigEntry && trigLines`). A dropped or event-narrowed immutability trigger →
  false → the check FAILS → `verify:live` exits non-zero.
- **read-path:** `npm run verify:live` prints
  `✓ PASS H2 finance immutability (fin_entries_immutable + fin_lines_immutable fns + triggers WIRED)` when
  healthy; a failure names H2 so the operator reads exactly which money-integrity guarantee lapsed.

Files:
- `scripts/verify-invariants-live.mjs` — extended the H2 check with the two trigger-wired assertions + a
  comment recording the silent-mutation bypass it closes.
