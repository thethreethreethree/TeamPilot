-- 0126 — Financial System fix: fin_init_company must seed an OPEN fiscal period
--
-- Adversarial self-audit (§1.5.2) of the Phase-2 posting functions found an operational bug: a
-- freshly-initialized company has a COA but NO fiscal period, and there is no period-creation
-- surface yet. fin_approve_bill / fin_approve_expense_report both require an OPEN period covering
-- the date, so on a fresh company EVERY approval fails with "No OPEN period covers …". That breaks
-- the intended verify-by-click flow. Fix: seed a current-year open period at init + backfill.
--
-- Idempotent. Periods are non-overlapping (0117 trigger), so the seed uses on-conflict-safe guards.

create or replace function fin_init_company(p_base_currency char(3) default 'USD')
returns void language plpgsql security definer set search_path = public as $$
declare v_company uuid; v_year text; v_start date; v_end date;
begin
  v_company := auth_company_id();
  if v_company is null then raise exception 'No company in context'; end if;
  if not fin_can_configure() then raise exception 'Not authorized to initialize finance'; end if;

  insert into fin_settings (company_id, base_currency, created_by)
    values (v_company, upper(p_base_currency), auth.uid()) on conflict (company_id) do nothing;

  insert into fin_accounts (company_id, code, name, type, normal_balance, is_system) values
    (v_company, '1000', 'Cash',                'asset',     'debit',  false),
    (v_company, '1100', 'Accounts Receivable', 'asset',     'debit',  false),
    (v_company, '1200', 'Tax Receivable',      'asset',     'debit',  false),
    (v_company, '1500', 'Fixed Assets',        'asset',     'debit',  false),
    (v_company, '2000', 'Accounts Payable',    'liability', 'credit', false),
    (v_company, '2100', 'Taxes Payable',       'liability', 'credit', false),
    (v_company, '2200', 'Employee Reimbursements Payable', 'liability', 'credit', false),
    (v_company, '3000', 'Retained Earnings',   'equity',    'credit', true),
    (v_company, '3100', 'Owner Equity',        'equity',    'credit', false),
    (v_company, '4000', 'Revenue',             'revenue',   'credit', false),
    (v_company, '5000', 'Cost of Goods Sold',  'expense',   'debit',  false),
    (v_company, '6000', 'Operating Expenses',  'expense',   'debit',  false),
    (v_company, '7900', 'FX Gain/Loss',        'expense',   'debit',  true)
    on conflict (company_id, code) do nothing;

  -- Seed a current-year OPEN period so the company can post immediately. Only if it has none
  -- (avoids the non-overlap trigger tripping on an existing period).
  v_year  := to_char(current_date, 'YYYY');
  v_start := date_trunc('year', current_date)::date;
  v_end   := (date_trunc('year', current_date) + interval '1 year' - interval '1 day')::date;
  if not exists (select 1 from fin_periods where company_id = v_company) then
    insert into fin_periods (company_id, name, start_date, end_date, status, created_by)
      values (v_company, v_year, v_start, v_end, 'open', auth.uid());
  end if;
end $$;

-- Backfill: any company that initialized finance (has fin_settings) but has NO period gets a
-- current-year open period, so already-initialized companies can post too.
insert into fin_periods (company_id, name, start_date, end_date, status)
select s.company_id, to_char(current_date, 'YYYY'),
       date_trunc('year', current_date)::date,
       (date_trunc('year', current_date) + interval '1 year' - interval '1 day')::date,
       'open'
from fin_settings s
where not exists (select 1 from fin_periods p where p.company_id = s.company_id);
