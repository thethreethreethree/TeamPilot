# BUILD — verify:live §3.2 trigger-wired assertion

### §3.2 understanding-gate trigger-wired check

Strengthened the existing `verify:live` §3.2 check in `scripts/verify-invariants-live.mjs`.

- **write-path:** the check now computes a third boolean `trigWired` — a live catalog query asserting a
  non-internal trigger on `problems` runs `check_understanding_gate` firing BEFORE, on BOTH INSERT and
  UPDATE (`(tgtype & 2)=2 and (tgtype & 4)=4 and (tgtype & 16)=16`) — and ANDs it into the pass condition
  (`gateFn && star && trigWired`). If the trigger is dropped or narrowed to UPDATE-only, `trigWired` is
  false → the check FAILS → `verify:live` exits non-zero → CI/the operator sees the §3.2 gate is un-wired.
- **read-path:** `npm run verify:live` (run in CI and manually against the live DB) prints
  `✓ PASS §3.2 understanding gate (raises + '*' threshold + trigger WIRED before insert-or-update)` when
  healthy; a failure names the §3.2 invariant so the operator reads exactly which thesis guarantee lapsed.

Files:
- `scripts/verify-invariants-live.mjs` — extended the §3.2 check with the trigger-wired assertion + a
  comment recording the bypass it closes and the 2026-07-31 empirical confirmation.
