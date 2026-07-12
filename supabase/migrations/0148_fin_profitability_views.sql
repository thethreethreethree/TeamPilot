-- 0148 — Financial System, PHASE 4 (increment 1): profitability derivations.
--
-- Margin = a GROUP of posted journal lines by dimension. Revenue = credit−debit on revenue-type lines;
-- cost = debit−credit on expense-type lines. Contribution margin = revenue − DIRECT cost (accounts
-- with cost_type='direct'); total margin = revenue − all cost. Only POSTED lines count. Untagged
-- activity (no project/cost center) is simply absent from these slices — visible on the statements.
-- security_invoker → tenant-safe. Read-only. Idempotent.

create or replace view fin_project_profitability with (security_invoker = true) as
select
  p.id as project_id, p.company_id, p.code, p.name, p.customer_id, p.status, p.budget,
  coalesce(sum(case when e.status='posted' and a.type='revenue' then l.base_credit - l.base_debit else 0 end), 0) as revenue,
  coalesce(sum(case when e.status='posted' and a.type='expense' and a.cost_type='direct' then l.base_debit - l.base_credit else 0 end), 0) as direct_cost,
  coalesce(sum(case when e.status='posted' and a.type='expense' then l.base_debit - l.base_credit else 0 end), 0) as total_cost
from fin_projects p
left join fin_journal_lines   l on l.project_id = p.id
left join fin_journal_entries e on e.id = l.entry_id
left join fin_accounts        a on a.id = l.account_id
group by p.id, p.company_id, p.code, p.name, p.customer_id, p.status, p.budget;

create or replace view fin_cost_center_profitability with (security_invoker = true) as
select
  cc.id as cost_center_id, cc.company_id, cc.code, cc.name, cc.is_active,
  coalesce(sum(case when e.status='posted' and a.type='revenue' then l.base_credit - l.base_debit else 0 end), 0) as revenue,
  coalesce(sum(case when e.status='posted' and a.type='expense' and a.cost_type='direct' then l.base_debit - l.base_credit else 0 end), 0) as direct_cost,
  coalesce(sum(case when e.status='posted' and a.type='expense' then l.base_debit - l.base_credit else 0 end), 0) as total_cost
from fin_cost_centers cc
left join fin_journal_lines   l on l.cost_center_id = cc.id
left join fin_journal_entries e on e.id = l.entry_id
left join fin_accounts        a on a.id = l.account_id
group by cc.id, cc.company_id, cc.code, cc.name, cc.is_active;

-- Customer profitability rolls project profitability up by the project's client link (the cheap cut;
-- a fuller version would also attribute AR revenue directly by customer).
create or replace view fin_customer_profitability with (security_invoker = true) as
select
  c.id as customer_id, c.company_id, c.name,
  coalesce(sum(pp.revenue), 0)    as revenue,
  coalesce(sum(pp.total_cost), 0) as total_cost
from fin_customers c
left join fin_project_profitability pp on pp.customer_id = c.id
group by c.id, c.company_id, c.name;
