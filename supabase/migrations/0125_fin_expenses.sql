-- 0125 — Financial System, Phase-2 Increment (Expense Management): reports → GL → reimbursement
--
-- Employee expense reports, mirroring the AP pattern. Submit (any employee) → approve (finance,
-- SoD: not your own) posts Dr expense + Dr Tax Receivable / Cr Employee Reimbursements Payable →
-- reimburse posts Dr that payable / Cr Cash. All GL posting via the 0122 primitive.
--
-- FLAGGED (access-model decision, built with a sensible default — say if you want it different):
-- expense SUBMISSION is open to ANY authenticated company member (an employee submits their OWN
-- report), because expense submission is an all-employee action, not a finance-role action. READING
-- others' reports + APPROVAL are finance-gated. If you want submission restricted to finance-role
-- holders only, that's a one-line RLS change.
--
-- NOTE: unlike the AP/AR system-post (Decision 1, no SoD), expense APPROVAL keeps a real SoD — you
-- cannot approve your OWN expense report. That SoD is a business rule at the approval step, distinct
-- from the mechanical GL posting.
--
-- Idempotent (A12). Acceptance: docs/financial-system/tests/0125_expenses.test.sql (structure);
-- approve/reimburse→GL is app-layer.

-- Employee Reimbursements Payable (2200) — add to the seed + backfill initialized companies.
create or replace function fin_init_company(p_base_currency char(3) default 'USD')
returns void language plpgsql security definer set search_path = public as $$
declare v_company uuid;
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
end $$;
insert into fin_accounts (company_id, code, name, type, normal_balance, is_system)
select s.company_id, '2200', 'Employee Reimbursements Payable', 'liability', 'credit', false
from fin_settings s
where not exists (select 1 from fin_accounts a where a.company_id = s.company_id and a.code = '2200');

create table if not exists fin_expense_reports (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references companies(id) on delete cascade,
  employee_user_id uuid not null references auth.users(id) on delete restrict,
  title            text not null,
  status           text not null default 'draft' check (status in ('draft','submitted','approved','reimbursed','rejected')),
  submitted_at     timestamptz,
  approved_by      uuid references auth.users(id) on delete set null,
  approved_at      timestamptz,
  posted_entry_id  uuid references fin_journal_entries(id) on delete restrict,
  reimbursed_at    timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists fin_expense_reports_company_idx on fin_expense_reports (company_id, status);
create index if not exists fin_expense_reports_employee_idx on fin_expense_reports (employee_user_id);

create table if not exists fin_expense_items (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade,
  report_id    uuid not null references fin_expense_reports(id) on delete cascade,
  line_no      int not null,
  account_id   uuid not null references fin_accounts(id) on delete restrict,  -- expense account
  description  text,
  category     text,
  amount       numeric(19,4) not null check (amount >= 0),
  tax_amount   numeric(19,4) not null default 0 check (tax_amount >= 0),
  expense_date date,
  receipt_url  text
);
create index if not exists fin_expense_items_report_idx on fin_expense_items (report_id);

-- Approve a submitted report → post the GL entry (SoD: approver <> employee).
create or replace function fin_approve_expense_report(p_report_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_company uuid; v_status text; v_emp uuid; v_base char(3); v_period uuid;
  v_pay uuid; v_taxrec uuid; v_lines jsonb; v_tax numeric(19,4); v_entry uuid;
begin
  if not fin_can_approve() then raise exception 'Not authorized to approve expense reports'; end if;
  select company_id, status, employee_user_id into v_company, v_status, v_emp
    from fin_expense_reports where id = p_report_id;
  if v_company is null or v_company <> auth_company_id() then raise exception 'Report not found in your company'; end if;
  if v_status <> 'submitted' then raise exception 'Only a submitted report can be approved (current: %)', v_status; end if;
  if v_emp = auth.uid() then raise exception 'Segregation of duties: you cannot approve your own expense report'; end if;

  select base_currency into v_base from fin_settings where company_id = v_company;
  select id into v_period from fin_periods
    where company_id = v_company and status = 'open' and current_date between start_date and end_date
    order by start_date desc limit 1;
  if v_period is null then raise exception 'No OPEN period covers today (for the reimbursement liability)'; end if;

  v_pay    := fin_account_by_code(v_company, '2200');   -- Employee Reimbursements Payable
  v_taxrec := fin_account_by_code(v_company, '1200');
  if v_pay is null then raise exception 'Employee Reimbursements Payable (2200) missing — initialize finance'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'account_id', account_id, 'debit', amount, 'credit', 0, 'currency', v_base,
           'memo', coalesce(description,'')) order by line_no), '[]'::jsonb),
         coalesce(sum(tax_amount),0)
    into v_lines, v_tax from fin_expense_items where report_id = p_report_id;
  if jsonb_array_length(v_lines) = 0 then raise exception 'Report has no items'; end if;

  if v_tax > 0 then
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'account_id', v_taxrec, 'debit', v_tax, 'credit', 0, 'currency', v_base, 'memo', 'Input tax'));
  end if;
  v_lines := v_lines || jsonb_build_array(jsonb_build_object(
    'account_id', v_pay, 'debit', 0,
    'credit', (select coalesce(sum(amount + tax_amount),0) from fin_expense_items where report_id = p_report_id),
    'currency', v_base, 'memo', 'Owed to employee'));

  v_entry := fin_post_system_entry(v_company, current_date, v_period,
    'Expense report ' || (select title from fin_expense_reports where id = p_report_id), 'expense', v_lines);
  insert into fin_source_postings (company_id, source_type, source_id, entry_id, kind)
    values (v_company, 'expense_report', p_report_id, v_entry, 'issue');
  update fin_expense_reports set status = 'approved', approved_by = auth.uid(), approved_at = now(),
    posted_entry_id = v_entry where id = p_report_id;
  return v_entry;
end $$;

-- Reimburse an approved report → Dr Employee Reimbursements Payable / Cr Cash.
create or replace function fin_reimburse_expense_report(p_report_id uuid, p_cash_code text default '1000')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_company uuid; v_status text; v_base char(3); v_period uuid; v_pay uuid; v_cash uuid; v_total numeric(19,4); v_entry uuid;
begin
  if not fin_can_approve() then raise exception 'Not authorized to reimburse'; end if;
  select company_id, status into v_company, v_status from fin_expense_reports where id = p_report_id;
  if v_company is null or v_company <> auth_company_id() then raise exception 'Report not found in your company'; end if;
  if v_status <> 'approved' then raise exception 'Only an approved report can be reimbursed (current: %)', v_status; end if;

  select base_currency into v_base from fin_settings where company_id = v_company;
  select id into v_period from fin_periods where company_id = v_company and status = 'open'
    and current_date between start_date and end_date order by start_date desc limit 1;
  if v_period is null then raise exception 'No OPEN period covers today'; end if;

  v_pay  := fin_account_by_code(v_company, '2200');
  v_cash := fin_account_by_code(v_company, p_cash_code);
  if v_pay is null or v_cash is null then raise exception 'Payable (2200) or cash (%) account missing', p_cash_code; end if;
  select coalesce(sum(amount + tax_amount),0) into v_total from fin_expense_items where report_id = p_report_id;

  v_entry := fin_post_system_entry(v_company, current_date, v_period,
    'Reimbursement: ' || (select title from fin_expense_reports where id = p_report_id), 'payment',
    jsonb_build_array(
      jsonb_build_object('account_id', v_pay,  'debit', v_total, 'credit', 0, 'currency', v_base, 'memo', 'Reimbursement settled'),
      jsonb_build_object('account_id', v_cash, 'debit', 0, 'credit', v_total, 'currency', v_base, 'memo', 'Cash out')
    ));
  insert into fin_source_postings (company_id, source_type, source_id, entry_id, kind)
    values (v_company, 'expense_report', p_report_id, v_entry, 'payment');
  update fin_expense_reports set status = 'reimbursed', reimbursed_at = now() where id = p_report_id;
  return v_entry;
end $$;

-- ── RLS ── submission open to any company member (own report); reads/approval finance-gated.
alter table fin_expense_reports enable row level security;
alter table fin_expense_items   enable row level security;

drop policy if exists "fin_expense_reports - select" on fin_expense_reports;
create policy "fin_expense_reports - select" on fin_expense_reports
  for select using (company_id = auth_company_id() and (employee_user_id = auth.uid() or fin_can_view()));
drop policy if exists "fin_expense_reports - insert" on fin_expense_reports;
create policy "fin_expense_reports - insert" on fin_expense_reports
  for insert with check (company_id = auth_company_id() and employee_user_id = auth.uid());
-- Employee may edit ONLY their own DRAFT, and may only move it draft→submitted (never directly to
-- approved/reimbursed — those come from the SECURITY DEFINER RPCs). This closes a self-approval hole.
drop policy if exists "fin_expense_reports - update own draft" on fin_expense_reports;
create policy "fin_expense_reports - update own draft" on fin_expense_reports
  for update using (company_id = auth_company_id() and employee_user_id = auth.uid() and status = 'draft')
  with check (company_id = auth_company_id() and employee_user_id = auth.uid() and status in ('draft','submitted'));

drop policy if exists "fin_expense_items - select" on fin_expense_items;
create policy "fin_expense_items - select" on fin_expense_items
  for select using (company_id = auth_company_id() and exists (
    select 1 from fin_expense_reports r where r.id = report_id
      and (r.employee_user_id = auth.uid() or fin_can_view())));
-- Items editable ONLY while the parent report is the employee's own DRAFT — so a report's items
-- can't change after it's submitted/approved+posted (the items would then disagree with the GL entry).
drop policy if exists "fin_expense_items - write own" on fin_expense_items;
create policy "fin_expense_items - write own" on fin_expense_items
  for all using (company_id = auth_company_id() and exists (
    select 1 from fin_expense_reports r where r.id = report_id and r.employee_user_id = auth.uid() and r.status = 'draft'))
  with check (company_id = auth_company_id() and exists (
    select 1 from fin_expense_reports r where r.id = report_id and r.employee_user_id = auth.uid() and r.status = 'draft'));

drop trigger if exists fin_audit_trg on fin_expense_reports;
create trigger fin_audit_trg after insert or update or delete on fin_expense_reports for each row execute function fin_audit();
drop trigger if exists fin_audit_trg on fin_expense_items;
create trigger fin_audit_trg after insert or update or delete on fin_expense_items for each row execute function fin_audit();

-- FLAGGED for Increment 2D: corporate-card reconciliation, mileage/per-diem, policy enforcement
-- (limits/disallowed categories). The report→GL→reimbursement spine is here.
