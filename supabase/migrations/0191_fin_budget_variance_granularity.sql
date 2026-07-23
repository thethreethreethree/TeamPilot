-- 0191 — fin_budget_variance: align actuals by the budget's OWN granularity (audit 2026-07-23).
--
-- BUG (0149): fin_budget_variance aligned every budget line's actuals by
--   `bl.period_index = 0 or extract(quarter from e.entry_date) = bl.period_index`
-- — i.e. QUARTERLY only. But fin_budgets.granularity allows 'monthly' (period_index 1-12), and for a
-- MONTHLY budget this is wrong: months 5-12 match ZERO actuals (extract(quarter) is only 1-4), and months
-- 1-4 mis-align to the same-numbered QUARTER (a March/period-3 line compares against Q3 = Jul-Sep actuals).
-- The variance alerts (0182) inherit the same window and so misfire on monthly budgets.
--
-- FIX: branch the period match on the budget's granularity (the view already joins fin_budgets b):
--   annual   → only period_index 0 (whole fiscal year)
--   quarterly→ extract(quarter) = period_index   (unchanged; 1-4)
--   monthly  → extract(month)   = period_index   (NEW; 1-12)
-- period_index = 0 always means the whole-year total, regardless of granularity (kept).
--
-- ADDITIVE + REVERSIBLE: a create-or-replace of a derived VIEW. No table, no column, no data migration,
-- no policy/trigger change. It only CORRECTS monthly-budget variance (currently wrong); quarterly/annual
-- variance is byte-for-byte unchanged. Logic mirror-tested in src/lib/finance/__tests__/budgetVarianceAlignment.test.ts
-- (the pure alignment predicate). STATIC-ONLY here — the founder confirms the live view on apply (a monthly
-- budget line's `actual` should now sum only that month's postings).
--
-- NOTE: this does NOT address the separate calendar-fiscal-year assumption (extract(year) = b.fiscal_year),
-- which is its own finding (a company on a non-calendar FY needs fin_settings.fiscal_year_start_month +
-- a date-window rewrite). This migration only fixes the WITHIN-year monthly/quarterly alignment.

create or replace view fin_budget_variance with (security_invoker = true) as
select
  bl.id as budget_line_id, bl.company_id, bl.budget_id, b.fiscal_year, b.name as budget_name,
  bl.account_id, a.code, a.name as account_name, a.type,
  bl.cost_center_id, bl.period_index, bl.amount as budget,
  coalesce((
    select sum(case when a.type in ('revenue','liability','equity')
                    then l.base_credit - l.base_debit
                    else l.base_debit - l.base_credit end)
    from fin_journal_lines l
    join fin_journal_entries e on e.id = l.entry_id
    where l.account_id = bl.account_id and e.status = 'posted'
      and l.cost_center_id is not distinct from bl.cost_center_id
      and extract(year from e.entry_date) = b.fiscal_year
      and (
        bl.period_index = 0
        or (b.granularity = 'quarterly' and extract(quarter from e.entry_date) = bl.period_index)
        or (b.granularity = 'monthly'   and extract(month   from e.entry_date) = bl.period_index)
      )
  ), 0) as actual
from fin_budget_lines bl
join fin_budgets b  on b.id = bl.budget_id
join fin_accounts a on a.id = bl.account_id;
