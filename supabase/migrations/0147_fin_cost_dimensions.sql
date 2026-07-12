-- 0147 — Financial System, PHASE 4 (increment 1): cost/profit DIMENSIONS (founder-confirmed 2026-07-13:
-- line-column attachment, cost center + project, services-style COGS).
--
-- Profitability is a SLICE of the GL, not parallel numbers. This adds two dimensions — cost_center and
-- project — as nullable columns on the P&L-bearing line tables, and threads them through the posting
-- path so a tag on a bill/invoice/expense line lands on the journal line it produces. Then margin =
-- group posted lines by dimension (view in 0148). Also adds cost_type (direct/indirect) on accounts
-- for direct-vs-indirect classification. No inventory (services-style COGS = a COGS account tagged
-- direct). Everything still traces to a posted journal line (section 3.1 holds). Idempotent.

-- ── Dimension master tables ──
create table if not exists fin_cost_centers (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  code       text not null,
  name       text not null,
  parent_id  uuid references fin_cost_centers(id) on delete set null,
  is_active  boolean not null default true,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint fin_cost_centers_code_uq unique (company_id, code)
);
create index if not exists fin_cost_centers_company_idx on fin_cost_centers (company_id, is_active);

create table if not exists fin_projects (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  code        text not null,
  name        text not null,
  customer_id uuid references fin_customers(id) on delete set null,   -- client link (customer profitability)
  status      text not null default 'active' check (status in ('active','closed')),
  start_date  date,
  budget      numeric(19,4),                                          -- optional, for project variance
  created_by  uuid default auth.uid() references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint fin_projects_code_uq unique (company_id, code)
);
create index if not exists fin_projects_company_idx on fin_projects (company_id, status);

-- ── Direct/indirect classification on accounts (services-style; overridable per line later). ──
alter table fin_accounts add column if not exists cost_type text not null default 'none'
  check (cost_type in ('direct','indirect','none'));

-- ── Dimension columns on the P&L-bearing line tables + the GL line. Nullable — tagging is optional. ──
alter table fin_journal_lines add column if not exists cost_center_id uuid references fin_cost_centers(id) on delete set null;
alter table fin_journal_lines add column if not exists project_id     uuid references fin_projects(id) on delete set null;
alter table fin_bill_lines    add column if not exists cost_center_id uuid references fin_cost_centers(id) on delete set null;
alter table fin_bill_lines    add column if not exists project_id     uuid references fin_projects(id) on delete set null;
alter table fin_invoice_lines add column if not exists cost_center_id uuid references fin_cost_centers(id) on delete set null;
alter table fin_invoice_lines add column if not exists project_id     uuid references fin_projects(id) on delete set null;
alter table fin_expense_items add column if not exists cost_center_id uuid references fin_cost_centers(id) on delete set null;
alter table fin_expense_items add column if not exists project_id     uuid references fin_projects(id) on delete set null;
create index if not exists fin_journal_lines_dim_idx on fin_journal_lines (cost_center_id, project_id);

-- ── fin_post_system_entry: pass cost_center_id / project_id from each line's jsonb onto the GL line.
--    (Re-created from 0122 with the two extra columns; all other logic identical.) ──
create or replace function fin_post_system_entry(
  p_company     uuid,
  p_entry_date  date,
  p_period_id   uuid,
  p_description text,
  p_source      text,
  p_lines       jsonb
) returns uuid language plpgsql
security definer set search_path = public as $$
declare v_entry uuid; v_line jsonb; v_ln int := 0; v_d numeric(19,4); v_c numeric(19,4); v_n int; v_no bigint;
begin
  if not fin_can_enter() then
    raise exception 'Not authorized to post finance entries';
  end if;
  if (select status from fin_periods where id = p_period_id) is distinct from 'open' then
    raise exception 'Cannot post into a non-open period';
  end if;

  insert into fin_journal_entries (company_id, entry_date, period_id, description, source, created_by, status)
    values (p_company, p_entry_date, p_period_id, p_description, p_source, auth.uid(), 'draft')
    returning id into v_entry;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_ln := v_ln + 1;
    insert into fin_journal_lines (company_id, entry_id, line_no, account_id, debit, credit, currency, memo, cost_center_id, project_id)
      values (
        p_company, v_entry, v_ln,
        (v_line->>'account_id')::uuid,
        coalesce((v_line->>'debit')::numeric, 0),
        coalesce((v_line->>'credit')::numeric, 0),
        v_line->>'currency',
        v_line->>'memo',
        nullif(v_line->>'cost_center_id','')::uuid,
        nullif(v_line->>'project_id','')::uuid
      );
  end loop;

  select coalesce(sum(base_debit),0), coalesce(sum(base_credit),0), count(*)
    into v_d, v_c, v_n from fin_journal_lines where entry_id = v_entry;
  if v_n < 2 then raise exception 'system entry needs at least 2 lines'; end if;
  if v_d <> v_c then raise exception 'system entry does not balance (% <> %)', v_d, v_c; end if;

  insert into fin_entry_counters (company_id, next_entry_no) values (p_company, 1)
    on conflict (company_id) do nothing;
  update fin_entry_counters set next_entry_no = next_entry_no + 1
    where company_id = p_company returning next_entry_no - 1 into v_no;
  update fin_journal_entries
    set status = 'posted', approved_by = auth.uid(), posted_at = now(), entry_no = v_no
    where id = v_entry;

  return v_entry;
end $$;
revoke execute on function fin_post_system_entry(uuid, date, uuid, text, text, jsonb) from authenticated, anon;

-- ── Posting functions: carry each source line's dimensions into the jsonb (control lines stay null). ──
create or replace function fin_approve_bill(p_bill_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_company uuid; v_status text; v_ccy char(3); v_date date; v_vendor uuid; v_creator uuid;
  v_period uuid; v_ap uuid; v_taxrec uuid; v_lines jsonb; v_tax numeric(19,4); v_entry uuid;
begin
  if not fin_can_approve() then raise exception 'Not authorized to approve bills'; end if;
  select company_id, status, currency, bill_date, vendor_id, created_by
    into v_company, v_status, v_ccy, v_date, v_vendor, v_creator
    from fin_bills where id = p_bill_id;
  if v_company is null or v_company <> auth_company_id() then raise exception 'Bill not found in your company'; end if;
  if v_status <> 'draft' then raise exception 'Only a draft bill can be approved (current: %)', v_status; end if;
  if v_creator = auth.uid() then raise exception 'Segregation of duties: you cannot approve a bill you created'; end if;

  select id into v_period from fin_periods
    where company_id = v_company and status = 'open' and v_date between start_date and end_date
    order by start_date desc limit 1;
  if v_period is null then raise exception 'No OPEN period covers the bill date %', v_date; end if;

  v_ap     := fin_account_by_code(v_company, '2000');
  v_taxrec := fin_account_by_code(v_company, '1200');
  if v_ap is null then raise exception 'Accounts Payable account (2000) missing — initialize finance'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'account_id', account_id, 'debit', amount, 'credit', 0, 'currency', v_ccy,
           'memo', coalesce(description,''),
           'cost_center_id', cost_center_id, 'project_id', project_id) order by line_no), '[]'::jsonb),
         coalesce(sum(tax_amount), 0)
    into v_lines, v_tax
    from fin_bill_lines where bill_id = p_bill_id;
  if jsonb_array_length(v_lines) = 0 then raise exception 'Bill has no lines'; end if;

  if v_tax > 0 then
    if v_taxrec is null then raise exception 'Tax Receivable account (1200) missing'; end if;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'account_id', v_taxrec, 'debit', v_tax, 'credit', 0, 'currency', v_ccy, 'memo', 'Input tax'));
  end if;
  v_lines := v_lines || jsonb_build_array(jsonb_build_object(
    'account_id', v_ap, 'debit', 0,
    'credit', (select coalesce(sum(amount + tax_amount),0) from fin_bill_lines where bill_id = p_bill_id),
    'currency', v_ccy, 'memo', 'Accounts Payable'));

  v_entry := fin_post_system_entry(v_company, v_date, v_period,
    'Bill ' || (select bill_number from fin_bills where id = p_bill_id), 'ap', v_lines);
  insert into fin_source_postings (company_id, source_type, source_id, entry_id, kind)
    values (v_company, 'ap_bill', p_bill_id, v_entry, 'issue');
  update fin_bills set status = 'approved', approved_by = auth.uid(), approved_at = now(),
    posted_entry_id = v_entry where id = p_bill_id;
  return v_entry;
end $$;

create or replace function fin_issue_invoice(p_invoice_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_company uuid; v_status text; v_ccy char(3); v_date date; v_creator uuid;
  v_period uuid; v_ar uuid; v_taxpay uuid; v_lines jsonb; v_tax numeric(19,4); v_grand numeric(19,4); v_entry uuid;
begin
  if not fin_can_approve() then raise exception 'Not authorized to issue invoices'; end if;
  select company_id, status, currency, invoice_date, created_by
    into v_company, v_status, v_ccy, v_date, v_creator
    from fin_invoices where id = p_invoice_id;
  if v_company is null or v_company <> auth_company_id() then raise exception 'Invoice not found in your company'; end if;
  if v_status <> 'draft' then raise exception 'Only a draft invoice can be issued (current: %)', v_status; end if;
  if v_creator = auth.uid() then raise exception 'Segregation of duties: you cannot issue an invoice you created'; end if;

  select id into v_period from fin_periods
    where company_id = v_company and status = 'open' and v_date between start_date and end_date
    order by start_date desc limit 1;
  if v_period is null then raise exception 'No OPEN period covers the invoice date %', v_date; end if;

  v_ar     := fin_account_by_code(v_company, '1100');
  v_taxpay := fin_account_by_code(v_company, '2100');
  if v_ar is null then raise exception 'Accounts Receivable account (1100) missing — initialize finance'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'account_id', revenue_account_id, 'debit', 0, 'credit', amount, 'currency', v_ccy,
           'memo', coalesce(description,''),
           'cost_center_id', cost_center_id, 'project_id', project_id) order by line_no), '[]'::jsonb),
         coalesce(sum(tax_amount),0),
         coalesce(sum(amount + tax_amount),0)
    into v_lines, v_tax, v_grand
    from fin_invoice_lines where invoice_id = p_invoice_id;
  if jsonb_array_length(v_lines) = 0 then raise exception 'Invoice has no lines'; end if;

  if v_tax > 0 then
    if v_taxpay is null then raise exception 'Taxes Payable account (2100) missing'; end if;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'account_id', v_taxpay, 'debit', 0, 'credit', v_tax, 'currency', v_ccy, 'memo', 'Output tax'));
  end if;
  v_lines := v_lines || jsonb_build_array(jsonb_build_object(
    'account_id', v_ar, 'debit', v_grand, 'credit', 0, 'currency', v_ccy, 'memo', 'Accounts Receivable'));

  v_entry := fin_post_system_entry(v_company, v_date, v_period,
    'Invoice ' || (select invoice_number from fin_invoices where id = p_invoice_id), 'ar', v_lines);
  insert into fin_source_postings (company_id, source_type, source_id, entry_id, kind)
    values (v_company, 'ar_invoice', p_invoice_id, v_entry, 'issue');
  update fin_invoices set status = 'sent', issued_by = auth.uid(), issued_at = now(),
    posted_entry_id = v_entry where id = p_invoice_id;
  return v_entry;
end $$;

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

  v_pay    := fin_account_by_code(v_company, '2200');
  v_taxrec := fin_account_by_code(v_company, '1200');
  if v_pay is null then raise exception 'Employee Reimbursements Payable (2200) missing — initialize finance'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'account_id', account_id, 'debit', amount, 'credit', 0, 'currency', v_base,
           'memo', coalesce(description,''),
           'cost_center_id', cost_center_id, 'project_id', project_id) order by line_no), '[]'::jsonb),
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

-- ── RLS: dimension masters are enter-level (accountants tag with them); author pinned + frozen. ──
alter table fin_cost_centers enable row level security;
alter table fin_projects     enable row level security;

drop policy if exists "fin_cost_centers - select" on fin_cost_centers;
create policy "fin_cost_centers - select" on fin_cost_centers
  for select using (company_id = auth_company_id() and fin_can_view());
drop policy if exists "fin_cost_centers - insert" on fin_cost_centers;
create policy "fin_cost_centers - insert" on fin_cost_centers
  for insert with check (company_id = auth_company_id() and fin_can_enter() and created_by = auth.uid());
drop policy if exists "fin_cost_centers - update" on fin_cost_centers;
create policy "fin_cost_centers - update" on fin_cost_centers
  for update using (company_id = auth_company_id() and fin_can_enter())
  with check (company_id = auth_company_id() and fin_can_enter());

drop policy if exists "fin_projects - select" on fin_projects;
create policy "fin_projects - select" on fin_projects
  for select using (company_id = auth_company_id() and fin_can_view());
drop policy if exists "fin_projects - insert" on fin_projects;
create policy "fin_projects - insert" on fin_projects
  for insert with check (company_id = auth_company_id() and fin_can_enter() and created_by = auth.uid());
drop policy if exists "fin_projects - update" on fin_projects;
create policy "fin_projects - update" on fin_projects
  for update using (company_id = auth_company_id() and fin_can_enter())
  with check (company_id = auth_company_id() and fin_can_enter());

drop trigger if exists fin_freeze_creator on fin_cost_centers;
create trigger fin_freeze_creator before update on fin_cost_centers for each row execute function fin_freeze_created_by();
drop trigger if exists fin_freeze_creator on fin_projects;
create trigger fin_freeze_creator before update on fin_projects for each row execute function fin_freeze_created_by();

drop trigger if exists fin_audit_trg on fin_cost_centers;
create trigger fin_audit_trg after insert or update or delete on fin_cost_centers for each row execute function fin_audit();
drop trigger if exists fin_audit_trg on fin_projects;
create trigger fin_audit_trg after insert or update or delete on fin_projects for each row execute function fin_audit();
