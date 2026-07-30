# Finance audit finding — FX per-line base rounding rejects face-balanced foreign entries

**Date:** 2026-07-30 · **Severity:** MEDIUM (blocks a legitimate posting; not a data-corruption/leak) ·
**Status:** CONFIRMED present in current code · **Disposition:** FOUNDER-GATED (money model + a DB
migration I cannot test live — surfaced, not fixed).

## The mechanism (exact locations)

`supabase/migrations/0118_fin_ledger.sql`:
- **L83-84** — `fin_lines_compute_base` rounds each line's base amount INDEPENDENTLY:
  `NEW.base_debit := round(NEW.debit * NEW.fx_rate, 4); NEW.base_credit := round(NEW.credit * NEW.fx_rate, 4);`
  (0119 upgrades this to use the authoritative table rate, but the per-line `round(…, 4)` is unchanged.)
- **L152 / L199 / L258** — every balance assertion (the T-8 commit backstop `fin_assert_balanced`, the
  post path, and the reversal path) compares `coalesce(sum(base_debit),0) <> coalesce(sum(base_credit),0)`.
- **L202** — on inequality: `raise exception 'Entry does not balance (debit % <> credit %)'`.

So balance is enforced on the SUM OF PER-LINE-ROUNDED BASE amounts, not on the exact (face × rate) value.

## Why it rejects a legitimate entry

`sum(round(debit_i × rate)) != round(sum(debit_i) × rate)` in general — rounding does not distribute over
addition. A foreign entry whose FACE debits == FACE credits can therefore have
`sum(base_debit) != sum(base_credit)` by a residual (a multiple of 0.0001), and be rejected.

### Concrete failing example (base cap = 4 decimals, rate 1.005)

- Debits (face): 33.33 + 33.33 + 33.33 = **99.99**. Each base = `round(33.33 × 1.005, 4)` =
  `round(33.49665, 4)` = 33.4967. Sum base_debit = **100.4901**.
- Credit (face): **99.99** (one line). base = `round(99.99 × 1.005, 4)` = `round(100.48995, 4)` = 100.4900.
  Sum base_credit = **100.4900**.
- Face balances (99.99 = 99.99) but base 100.4901 ≠ 100.4900 → **`Entry does not balance` — REJECTED.**

## Recommended fix (a money-model decision — needs the founder)

The standard accounting handling is NOT to reject, but to absorb the sub-unit residual:

1. **Rounding-adjustment account (recommended):** compute the base residual
   `sum(base_debit) − sum(base_credit)`; if it is within a tolerance (e.g. ±0.01 × line_count, or a fixed
   few cents), post the residual as a line to a dedicated **"FX rounding"** system account so the entry
   balances exactly in base. This is auditable (the residual is a real, named line) and preserves
   double-entry. Requires: a system account (like the FX gain/loss account 0119 anticipates) + a tolerance
   the founder sets.
2. **Alternative — assert balance on FACE, per currency:** require `sum(debit)=sum(credit)` per line
   currency (economic balance), and treat base as derived/reportable rather than the balance invariant.
   Larger model change; base sums would then be allowed to differ by the rounding residual.

Both are DB-migration changes to money code that must be applied + tested against real multi-currency
entries — hence founder-gated. Recommend option 1 (smallest change, keeps base as the balance invariant,
makes the residual explicit).

## Verification note

Confirmed by reading 0118 (the per-line round + the three base-balance assertions) — NOT reproduced
against a live DB (no multi-currency entry was posted). The arithmetic above is exact-decimal, so the
rejection is deterministic for the shown inputs. A regression test should use exact-decimal (not float)
arithmetic to prove money behavior (per the standing "prove money bugs with exact-decimal" discipline).

## Adjacent FX surfaces checked (this audit's scope)

- **AP/AR foreign-currency SETTLEMENT (realized FX gain/loss)** — checked, NOT a bug: it is HONESTLY
  DEFERRED with a loud guard. `0124:52` (AP payments), `0127:29` (pay-bill), `0132:46` (AR receipts) each
  `raise exception 'Foreign-currency settlement … realizes FX gain/loss vs the booking rate — that
  increment is not built yet. Base-currency … only for now.'` So a foreign settlement fails clearly rather
  than mis-computing gain/loss — the correct honesty-first posture (build only the shipped part, refuse the
  rest loudly).
- **Period-containment** (entry_date must fall in the resolved period) — already on record separately
  (`reference_gate_keys_on_reference_not_data`), not re-opened here.

So within multi-currency, the POST-time per-line rounding above is the one live correctness defect; the
settlement path is a clean deferral, not a silent bug.
