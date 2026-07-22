# FX per-line rounding can reject a balanced foreign-currency entry — 2026-07-23

**Severity:** HIGH for multi-currency users · ZERO for base-currency-only users.
**Status:** real, reachable, **undocumented and unhandled** (contrast the tax-report limitation, which was
flagged + UI-warned). Surfaced for a founder/accounting decision — NOT auto-fixed (the remedy changes the books).

## The defect

`fin_lines_compute_base` (0118/0119) sets each line's base amount independently:

```sql
NEW.base_debit  := round(NEW.debit  * NEW.fx_rate, 4);
NEW.base_credit := round(NEW.credit * NEW.fx_rate, 4);
```

`fin_assert_balanced` (0118) then requires the base totals to tie with **exact** equality (`if v_d <> v_c then
raise 'UNBALANCED'`) — no tolerance. Rounding each line independently does **not** distribute over a sum, so an
entry that balances in its FACE currency can have base totals that differ by a cent, and gets rejected.

## Proof (exact decimal, mirroring Postgres `numeric` — not float)

Rate 1.0001, entry **Dr 0.87 + Dr 1.50 = Cr 2.37** (balances in face: 0.87 + 1.50 = 2.37):

| line | face | base = round(face × 1.0001, 4) |
|---|---|---|
| Dr | 0.87 | 0.8701 |
| Dr | 1.50 | 1.5002 |
| **Σ Dr base** | | **2.3703** |
| Cr | 2.37 | **2.3702** |

2.3703 ≠ 2.3702 → **rejected "UNBALANCED (debit 2.3703 <> credit 2.3702)."** An exact-arithmetic sweep of
~500M balanced-in-face 2-line entries (rates 1.0000–1.5000 @ 4dp, totals to 1000.00) found **24.7% diverge** by
exactly 0.0001. (A first *hand*-worked example appeared to diverge but actually balanced — arithmetic error;
only the exact empirical sweep is trustworthy here. Base-currency-only entries never diverge: currency = base →
rate 1 → base = face.)

## Reachability

`fin_approve_bill` (0130) builds a multi-line entry in the bill's currency — Dr expense line(s) + Dr tax + Cr AP
— posted through `compute_base` + `fin_assert_balanced`. So **approving a foreign-currency bill with tax or
multiple lines can hard-fail** for ~1-in-4 amount/rate combinations. Same path: foreign AR invoices
(`fin_issue_invoice`), expense reports, and any manual foreign journal with split lines. It never affects
single-currency (base) accounting, which is likely why it hasn't surfaced yet.

## Fix options (accounting decision — do NOT pick silently)

1. **Rounding-difference line (standard GL practice):** after computing base amounts, if `Σbase_dr ≠ Σbase_cr`,
   append a balancing line for the residual to a dedicated **"FX Rounding" P&L account**. Transparent, named,
   auditable — matches this codebase's stated philosophy ("we do not plug silently; the residual has a name" —
   0169 opening balances). Recommended.
2. **Plug the largest line:** set the base amount of the largest line to the balancing figure instead of its
   independent rounding. No extra account, but a line's base then differs from `round(face × rate)` by a cent.
3. **Sub-cent tolerance in `fin_assert_balanced`:** accept `|v_d − v_c| < 0.005`. Simplest, but silently
   accumulates and leaves the GL a cent off — weakest, and against the "surface don't absorb" principle.

Option 1 is the cleanest and most consistent with the project's own opening-balance philosophy. It touches the
ledger, so it needs founder/accountant sign-off + a migration + a test; flagged rather than built.

## Verify on a live DB

Enter a rate `EUR→USD = 1.0001`, create a EUR bill with lines summing to 0.87 + 1.50 and no tax (or the tax
equivalent), approve it → observe the UNBALANCED rejection. (Sandbox can't reach the DB; the arithmetic above is
the offline proof.)
