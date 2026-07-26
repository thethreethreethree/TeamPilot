-- 0191 — fin_budget_variance: align actuals by the budget's OWN granularity (audit 2026-07-23; corrected 2026-07-26).
--
-- BUG (0149): the view aligned actuals by extract(quarter) ONLY. For a MONTHLY budget it is wrong: months
-- 5-12 match ZERO actuals, months 1-4 mis-align to the same-numbered quarter, and the variance ALERTS
-- (0182) inherit the same window. FIX: branch the period match on the budget's granularity in EVERY
-- subquery (period_index 0 = whole year; quarterly = extract(quarter); monthly = extract(month)).
--
-- CORRECTED 2026-07-26 (db:apply failed here): the original 0191 was written against the 0149 view (13
-- cols) and its create-or-replace DROPPED the 3 columns 0182 added (alert_threshold_pct, variance_pct,
-- is_alert) -> Postgres "cannot drop columns from view". This version reproduces 0182's FULL 16-column
-- definition (nothing dropped) and applies the granularity branch to ALL FOUR subqueries (actual +
-- variance_pct + both is_alert branches), also fixing the alerts' monthly window. Additive + reversible.

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
      and (bl.period_index = 0
         or (b.granularity = 'quarterly' and extract(quarter from e.entry_date) = bl.period_index)
         or (b.granularity = 'monthly'   and extract(month   from e.entry_date) = bl.period_index))
  ), 0) as actual,

  -- ── NEW: the threshold, and whether this line has breached it ──
  s.variance_alert_pct as alert_threshold_pct,

  -- How far off, as a percentage of budget. NULL when the budget is zero — a percentage of nothing is
  -- undefined, not infinite, and certainly not 0. A 0 here would silently classify a line that spent
  -- £40,000 against a £0 budget as perfectly on-plan.
  case when bl.amount <> 0 then
    round(((coalesce((
      select sum(case when a.type in ('revenue','liability','equity')
                      then l.base_credit - l.base_debit
                      else l.base_debit - l.base_credit end)
      from fin_journal_lines l
      join fin_journal_entries e on e.id = l.entry_id
      where l.account_id = bl.account_id and e.status = 'posted'
        and l.cost_center_id is not distinct from bl.cost_center_id
        and extract(year from e.entry_date) = b.fiscal_year
        and (bl.period_index = 0
         or (b.granularity = 'quarterly' and extract(quarter from e.entry_date) = bl.period_index)
         or (b.granularity = 'monthly'   and extract(month   from e.entry_date) = bl.period_index))
    ), 0) - bl.amount) / abs(bl.amount)) * 100, 2)
  end as variance_pct,

  -- THE ALERT. Direction-aware, deliberately:
  --   expense → alert when actual is ABOVE budget by more than the threshold (overspend)
  --   revenue → alert when actual is BELOW budget by more than the threshold (undershoot)
  -- A naive abs(variance) > threshold would fire happily on a month the company BEAT its sales target,
  -- and an alert that celebrates good news is an alert people stop reading.
  case when bl.amount <> 0 then
    case when a.type = 'revenue'
      then ((bl.amount - coalesce((
             select sum(l.base_credit - l.base_debit)
               from fin_journal_lines l
               join fin_journal_entries e on e.id = l.entry_id
              where l.account_id = bl.account_id and e.status = 'posted'
                and l.cost_center_id is not distinct from bl.cost_center_id
                and extract(year from e.entry_date) = b.fiscal_year
                and (bl.period_index = 0
         or (b.granularity = 'quarterly' and extract(quarter from e.entry_date) = bl.period_index)
         or (b.granularity = 'monthly'   and extract(month   from e.entry_date) = bl.period_index))
           ), 0)) / abs(bl.amount)) * 100 > s.variance_alert_pct
      else ((coalesce((
             select sum(l.base_debit - l.base_credit)
               from fin_journal_lines l
               join fin_journal_entries e on e.id = l.entry_id
              where l.account_id = bl.account_id and e.status = 'posted'
                and l.cost_center_id is not distinct from bl.cost_center_id
                and extract(year from e.entry_date) = b.fiscal_year
                and (bl.period_index = 0
         or (b.granularity = 'quarterly' and extract(quarter from e.entry_date) = bl.period_index)
         or (b.granularity = 'monthly'   and extract(month   from e.entry_date) = bl.period_index))
           ), 0) - bl.amount) / abs(bl.amount)) * 100 > s.variance_alert_pct
    end
  end as is_alert

from fin_budget_lines bl
join fin_budgets  b on b.id = bl.budget_id
join fin_accounts a on a.id = bl.account_id
join fin_settings s on s.company_id = bl.company_id;
