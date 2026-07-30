# Finance audit finding — year-end close + budgeting silently assume a CALENDAR fiscal year

**Date:** 2026-07-30 · **Severity:** MEDIUM-HIGH (silently wrong year-end financials for any non-calendar
fiscal year — a large global subset: UK/India Apr–Mar, Australia Jul–Jun, many US entities Oct–Sep) ·
**Status:** CONFIRMED present · **Disposition:** FOUNDER-GATED (a finance-model decision + a DB migration
I cannot test live — surfaced, not fixed). Distinct from the FX-rounding finding.

## The contradiction

**Periods are FREE-FORM** — `supabase/migrations/0117_fin_periods.sql:16-17` stores arbitrary
`start_date`/`end_date`; the only constraints are `end_date >= start_date` (L23) and no-overlap (L39).
So a company CAN legitimately create fiscal periods like Apr 2026 … Mar 2027 (their fiscal year).

**But year-end close + budgeting hardcode the CALENDAR year:**
- `fin_close_year` (`0151`): gathers P&L via `extract(year from e.entry_date) = p_fiscal_year` (L56);
  posts the closing entry on `make_date(p_fiscal_year, 12, 31)` (L38); locks periods with
  `start_date >= make_date(y,1,1) and end_date <= make_date(y,12,31)` (L96-97).
- `fin_budget_variance` view (`0149:54`): `extract(year from e.entry_date) = b.fiscal_year`.

There is NO `fiscal_year_start` (or equivalent) column in `fin_settings` — only a bare `fiscal_year int`
on budgets + year-closes. So the system offers no way to declare a non-calendar fiscal year, yet lets you
build periods for one.

## Impact (non-calendar fiscal year, e.g. Apr–Mar)

Calling `fin_close_year(2026)` for a company whose FY2026 is Apr 2026 – Mar 2027:
- **Wrong P&L window** — it closes calendar Jan–Dec 2026 activity, not the company's actual fiscal year →
  the net income rolled to **Retained Earnings is wrong** (includes Jan–Mar 2026, excludes Jan–Mar 2027).
- **Wrong period locks** — it locks Jan–Dec 2026 periods, not the company's Apr–Mar fiscal periods; the
  actual fiscal periods stay open and the wrong ones freeze.
- **Wrong budget variance** — actuals are gathered by calendar year, mismatching a fiscal-year budget.

And it does all this **SILENTLY** — no exception, no UI warning (contrast the tax report, which explicitly
warns about credit-note un-netting). A user on a non-calendar fiscal year gets confidently-wrong year-end
financials.

## Recommended fix (founder-gated — a model decision)

Two honest options:
1. **Support non-calendar fiscal years (recommended if the market needs it):** add
   `fin_settings.fiscal_year_start_month int (1–12, default 1)`. Derive the fiscal window as
   `[make_date(fy, start_month, 1), make_date(fy+1, start_month, 1))` and replace every
   `extract(year from entry_date)` / `make_date(y,1,1..12,31)` in `fin_close_year` + the budget view with
   that window. A DB migration to money code — apply + test against a non-calendar setup.
2. **Commit to calendar-year-only (smaller):** ENFORCE it — constrain period creation to calendar-year
   boundaries (or at least document + WARN in the finance UI that the fiscal year = the calendar year), so
   the assumption is honest and a non-calendar company can't silently mis-close. This is the "refuse the
   unsupported case loudly" posture the FX-settlement path already uses.

Either removes the SILENT wrongness. Recommend deciding based on whether non-calendar fiscal years are a
target market; if unsure, option 2 now (make it honest) + option 1 later (make it capable).

## Verification note

Confirmed by reading 0117 (free-form periods), 0151 (calendar-hardcoded close), 0149 (calendar-hardcoded
budget), and grepping fin_settings for a fiscal-year-start column (none). Not reproduced against a live DB.
