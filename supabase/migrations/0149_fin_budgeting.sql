-- 0149 — Financial System, PHASE 5 (increment 1): Budgeting + variance + runway (founder-confirmed
-- 2026-07-13: account × cost-center, quarterly, budget+variance+runway; forecasts deferred).
--
-- A budget is TARGETS laid over the actuals, never a second source of truth. Actuals come from the
-- posted ledger (sliced by quarter + cost center, using Phase-4 dimensions); variance = actual −
-- budget. Idempotent. Author pinned+frozen (0142). Everything derives from posted lines (section 3.1).

-- Company variance-alert threshold (percent). Default 10% (founder default).
alter table fin_settings add column if not exists variance_alert_pct numeric(6,2) not null default 10;

create table if not exists fin_budgets (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade,
  name         text not null,
  fiscal_year  int not null,
  granularity  text not null default 'quarterly' check (granularity in ('annual','quarterly','monthly')),
  status       text not null default 'draft' check (status in ('draft','active','archived')),
  created_by   uuid default auth.uid() references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint fin_budgets_name_uq unique (company_id, name)
);
create index if not exists fin_budgets_company_idx on fin_budgets (company_id, fiscal_year);

create table if not exists fin_budget_lines (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references companies(id) on delete cascade,
  budget_id      uuid not null references fin_budgets(id) on delete cascade,
  account_id     uuid not null references fin_accounts(id) on delete restrict,
  cost_center_id uuid references fin_cost_centers(id) on delete set null,   -- null = company-wide (untagged actuals)
  period_index   int not null default 0 check (period_index between 0 and 12),  -- 0 = whole year; 1-4 quarter; 1-12 month
  amount         numeric(19,4) not null default 0,
  -- NULLS NOT DISTINCT (PG15+): a company-wide line (cost_center_id NULL) must still dedupe on upsert;
  -- default null-distinct behaviour would let duplicates through for the null-cost-center case.
  constraint fin_budget_line_uq unique nulls not distinct (budget_id, account_id, cost_center_id, period_index)
);
create index if not exists fin_budget_lines_budget_idx on fin_budget_lines (budget_id);

-- ── Budget vs actual: each budget line's actual (posted, same account × cost-center × quarter of the
--    fiscal year) and the variance. Actual is in the account's NATURAL direction (so an expense
--    budget vs expense actual compare like-for-like). period_index 0 = the whole fiscal year. ──
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
  ), 0) as actual
from fin_budget_lines bl
join fin_budgets b  on b.id = bl.budget_id
join fin_accounts a on a.id = bl.account_id;

-- ── Runway: cash on hand / average monthly net burn (trailing 3 months). Honest + labeled: cash uses
--    the same name-heuristic as the dashboard (flagged there); burn is (expense − revenue) over the
--    last 3 months / 3; if not burning (profitable), runway is null (∞). No assumptions/forecast. ──
create or replace function fin_runway()
returns jsonb language sql stable security invoker set search_path = public as $$
  with co as (select auth_company_id() as cid),
  cash as (
    select coalesce(sum(balance),0) as v from fin_account_balances
    where company_id = (select cid from co) and type = 'asset' and (name ilike '%cash%' or name ilike '%bank%')
  ),
  burn as (
    select coalesce(sum(case when a.type='expense' then l.base_debit - l.base_credit
                             when a.type='revenue' then -(l.base_credit - l.base_debit) else 0 end), 0) / 3.0 as monthly
    from fin_journal_lines l
    join fin_journal_entries e on e.id = l.entry_id
    join fin_accounts a on a.id = l.account_id
    where l.company_id = (select cid from co) and e.status = 'posted'
      and a.type in ('expense','revenue')
      and e.entry_date >= (current_date - interval '3 months')
  )
  select jsonb_build_object(
    'cash_on_hand', (select v from cash),
    'monthly_burn', (select monthly from burn),
    'runway_months', case when (select monthly from burn) > 0
                          then round((select v from cash) / (select monthly from burn), 1)
                          else null end
  );
$$;

-- ── RLS: budget entry is enter-level; author pinned + frozen. ──
alter table fin_budgets      enable row level security;
alter table fin_budget_lines enable row level security;

drop policy if exists "fin_budgets - select" on fin_budgets;
create policy "fin_budgets - select" on fin_budgets
  for select using (company_id = auth_company_id() and fin_can_view());
drop policy if exists "fin_budgets - insert" on fin_budgets;
create policy "fin_budgets - insert" on fin_budgets
  for insert with check (company_id = auth_company_id() and fin_can_enter() and created_by = auth.uid());
drop policy if exists "fin_budgets - update" on fin_budgets;
create policy "fin_budgets - update" on fin_budgets
  for update using (company_id = auth_company_id() and fin_can_enter())
  with check (company_id = auth_company_id() and fin_can_enter());
drop policy if exists "fin_budgets - delete" on fin_budgets;
create policy "fin_budgets - delete" on fin_budgets
  for delete using (company_id = auth_company_id() and fin_can_enter());

drop policy if exists "fin_budget_lines - select" on fin_budget_lines;
create policy "fin_budget_lines - select" on fin_budget_lines
  for select using (company_id = auth_company_id() and fin_can_view());
drop policy if exists "fin_budget_lines - write" on fin_budget_lines;
create policy "fin_budget_lines - write" on fin_budget_lines
  for all using (company_id = auth_company_id() and fin_can_enter())
  with check (company_id = auth_company_id() and fin_can_enter());

drop trigger if exists fin_freeze_creator on fin_budgets;
create trigger fin_freeze_creator before update on fin_budgets for each row execute function fin_freeze_created_by();

drop trigger if exists fin_audit_trg on fin_budgets;
create trigger fin_audit_trg after insert or update or delete on fin_budgets for each row execute function fin_audit();
drop trigger if exists fin_audit_trg on fin_budget_lines;
create trigger fin_audit_trg after insert or update or delete on fin_budget_lines for each row execute function fin_audit();
