-- 0182 — MAKE variance_alert_pct REAL (it was dead config that looked like a feature).
--
-- Found by the reachability gate I built after walking into the same blind spot four times in one session.
--
-- ── THE FINDING ──────────────────────────────────────────────────────────────────────────────
--
-- 0149 added fin_settings.variance_alert_pct (default 10). Nothing in the database ever READ it, and
-- nothing in the product could ever WRITE it.
--
-- It was a settings column that did nothing. And that is worse than an absent feature, because a settings
-- column IMPLIES a working control: a reader of the schema — or a future author of this system — would
-- reasonably conclude that budget overspends were being flagged at some threshold. They were not being
-- flagged at all. Dead config is a promise the system has no intention of keeping.
--
-- So it becomes real: the variance view now flags a line that has overspent its budget by more than the
-- company's threshold, and the threshold is settable.
--
-- ── WHY OVERSPEND ONLY, AND NOT "OFF BY MORE THAN X" ─────────────────────────────────────────
--
-- Coming in UNDER budget on an expense is not an exception worth an alert. It might be prudence, or a
-- delayed project, or a supplier who has not invoiced yet — and flagging it trains people to ignore the
-- flag, which is how the one genuine overspend gets scrolled past (§A25).
--
-- REVENUE is the mirror image: for a revenue line, the failure is coming in UNDER, not over. The same
-- absolute deviation means opposite things depending on which side of the ledger it falls, and a naive
-- abs(variance) > threshold would cheerfully alert on a month where the company beat its sales target.
--
-- Idempotent (§A12). NOT VERIFIED against a live database. BUILT, not TESTED.

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
      and (bl.period_index = 0 or extract(quarter from e.entry_date) = bl.period_index)
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
        and (bl.period_index = 0 or extract(quarter from e.entry_date) = bl.period_index)
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
                and (bl.period_index = 0 or extract(quarter from e.entry_date) = bl.period_index)
           ), 0)) / abs(bl.amount)) * 100 > s.variance_alert_pct
      else ((coalesce((
             select sum(l.base_debit - l.base_credit)
               from fin_journal_lines l
               join fin_journal_entries e on e.id = l.entry_id
              where l.account_id = bl.account_id and e.status = 'posted'
                and l.cost_center_id is not distinct from bl.cost_center_id
                and extract(year from e.entry_date) = b.fiscal_year
                and (bl.period_index = 0 or extract(quarter from e.entry_date) = bl.period_index)
           ), 0) - bl.amount) / abs(bl.amount)) * 100 > s.variance_alert_pct
    end
  end as is_alert

from fin_budget_lines bl
join fin_budgets  b on b.id = bl.budget_id
join fin_accounts a on a.id = bl.account_id
join fin_settings s on s.company_id = bl.company_id;
