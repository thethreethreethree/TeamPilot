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
single-currency (base) accounting.

### LATENT today — not reachable via the current UI (refined 2026-07-23)

`fin_bills.currency` (and invoice/expense currency) is a free `char(3)` with no base-currency restriction, so
foreign documents CAN be booked at the DB/API layer. **But no finance create form exposes a currency picker** —
the FX-rate *management* page (controls) lets you enter EUR→USD rates, yet nothing can be denominated in a
foreign currency through the UI. So today this bug is reachable ONLY via direct DB/API calls; a normal user
posts base-currency documents and never hits it. It becomes ACTIVE the moment a foreign-currency entry point
ships in the UI. Net: **a real bug, currently latent behind an unbuilt entry path** — fix it before (or with)
exposing multi-currency document entry, not as an emergency. Related latent gap in the same half-built feature:
foreign settlement is explicitly rejected (0124/0132), so even a DB-booked foreign bill couldn't be paid in-app
(a "book-but-can't-settle" dead-end) — another reason multi-currency needs a completed increment before exposure.

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

### Interim stopgap (cheaper than the full fix, if you want cover NOW)

The settlement path ALREADY rejects foreign currency explicitly (0124/0132: "base-currency payments only for
now"). The BOOKING path (`fin_approve_bill`, `fin_issue_invoice`, `fin_approve_expense_report`) simply MISSED
the same guard — which is why foreign booking currently succeeds ~75% / hard-fails ~25% / strands the payable.
A **symmetric fail-closed guard** on those three functions — reject a non-base document currency with a clear
"foreign-currency documents aren't supported yet — base currency only" message — would:
- make the half-built feature CONSISTENTLY refuse foreign (matching settlement),
- turn the confusing UNBALANCED error into an honest, actionable one (§3.4),
- prevent the book-but-can't-settle dead-end,
- be trivially reversible when the real multi-currency increment (with the rounding-difference line) ships.
It applies your ALREADY-MADE "base-currency only for now" decision consistently, rather than introducing a new
one — so it's low-risk. **Decide:** interim symmetric reject now, or go straight to the full increment (Option 1
rounding line + foreign settlement)? Either is a small, testable build I do on your word; I did not apply the
reject unilaterally because it changes finance posting behavior (§2).

## Verify on a live DB

Enter a rate `EUR→USD = 1.0001`, create a EUR bill with lines summing to 0.87 + 1.50 and no tax (or the tax
equivalent), approve it → observe the UNBALANCED rejection. (Sandbox can't reach the DB; the arithmetic above is
the offline proof.)
