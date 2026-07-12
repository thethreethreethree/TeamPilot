-- 0131 — Financial System, Phase-2 Increment 2A (AR core): finance-native customers + invoices → GL
--
-- Founder decision: Option B (finance-native AR), so every tenant has its own AR independent of the
-- vendor CRM. Mirrors the (hardened) AP pattern. Issuing an invoice posts Dr Accounts Receivable /
-- Cr Revenue (+ Cr Tax Payable, output tax capture-only) via the 0122 primitive. Built with the AP
-- audit lessons applied UP FRONT: draft-only client writes, source-document SoD (creator ≠ issuer).
--
-- Idempotent (A12). Acceptance: docs/financial-system/tests/0131_ar_core.test.sql (structure);
-- issue→GL + SoD are app-layer.

create table if not exists fin_customers (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name       text not null,
  email      text,
  terms_days int not null default 30,
  is_active  boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint fin_customers_company_name_uq unique (company_id, name)
);
create index if not exists fin_customers_company_idx on fin_customers (company_id);

create table if not exists fin_invoices (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references companies(id) on delete cascade,
  customer_id    uuid not null references fin_customers(id) on delete restrict,
  invoice_number text not null,
  invoice_date   date not null,
  due_date       date,
  currency       char(3),
  status         text not null default 'draft' check (status in ('draft','sent','paid','void')),
  memo           text,
  posted_entry_id uuid references fin_journal_entries(id) on delete restrict,
  created_by     uuid references auth.users(id) on delete set null,
  issued_by      uuid references auth.users(id) on delete set null,
  issued_at      timestamptz,
  created_at     timestamptz not null default now(),
  constraint fin_invoices_number_uq unique (company_id, customer_id, invoice_number)
);
create index if not exists fin_invoices_company_status_idx on fin_invoices (company_id, status);

create table if not exists fin_invoice_lines (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references companies(id) on delete cascade,
  invoice_id         uuid not null references fin_invoices(id) on delete cascade,
  line_no            int not null,
  revenue_account_id uuid not null references fin_accounts(id) on delete restrict,
  description        text,
  amount             numeric(19,4) not null check (amount >= 0),
  tax_amount         numeric(19,4) not null default 0 check (tax_amount >= 0)
);
create index if not exists fin_invoice_lines_invoice_idx on fin_invoice_lines (invoice_id);

-- Issue a draft invoice → post Dr AR / Cr Revenue (+ Cr Tax Payable). SoD: issuer ≠ creator.
create or replace function fin_issue_invoice(p_invoice_id uuid)
returns uuid language plpgsql
security definer set search_path = public as $$
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

  v_ar     := fin_account_by_code(v_company, '1100');   -- Accounts Receivable
  v_taxpay := fin_account_by_code(v_company, '2100');   -- Taxes Payable (output tax)
  if v_ar is null then raise exception 'Accounts Receivable account (1100) missing — initialize finance'; end if;

  -- Cr each revenue line; sum tax + grand total.
  select coalesce(jsonb_agg(jsonb_build_object(
           'account_id', revenue_account_id, 'debit', 0, 'credit', amount, 'currency', v_ccy,
           'memo', coalesce(description,'')) order by line_no), '[]'::jsonb),
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
  -- Dr Accounts Receivable for the grand total.
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

-- ── RLS (draft-lock applied from the start — the lesson from the AP bills audit) ──
alter table fin_customers     enable row level security;
alter table fin_invoices      enable row level security;
alter table fin_invoice_lines enable row level security;

drop policy if exists "fin_customers - select" on fin_customers;
create policy "fin_customers - select" on fin_customers for select using (company_id = auth_company_id() and fin_can_view());
drop policy if exists "fin_customers - write" on fin_customers;
create policy "fin_customers - write" on fin_customers for all using (company_id = auth_company_id() and fin_can_enter()) with check (company_id = auth_company_id() and fin_can_enter());

drop policy if exists "fin_invoices - select" on fin_invoices;
create policy "fin_invoices - select" on fin_invoices for select using (company_id = auth_company_id() and fin_can_view());
drop policy if exists "fin_invoices - insert" on fin_invoices;
create policy "fin_invoices - insert" on fin_invoices for insert with check (company_id = auth_company_id() and fin_can_enter() and status = 'draft');
drop policy if exists "fin_invoices - update draft" on fin_invoices;
create policy "fin_invoices - update draft" on fin_invoices for update using (company_id = auth_company_id() and fin_can_enter() and status = 'draft') with check (company_id = auth_company_id() and fin_can_enter() and status = 'draft');
drop policy if exists "fin_invoices - delete draft" on fin_invoices;
create policy "fin_invoices - delete draft" on fin_invoices for delete using (company_id = auth_company_id() and fin_can_enter() and status = 'draft');

drop policy if exists "fin_invoice_lines - select" on fin_invoice_lines;
create policy "fin_invoice_lines - select" on fin_invoice_lines for select using (company_id = auth_company_id() and fin_can_view());
drop policy if exists "fin_invoice_lines - write draft" on fin_invoice_lines;
create policy "fin_invoice_lines - write draft" on fin_invoice_lines for all
  using (company_id = auth_company_id() and fin_can_enter() and exists (select 1 from fin_invoices i where i.id = invoice_id and i.status = 'draft'))
  with check (company_id = auth_company_id() and fin_can_enter() and exists (select 1 from fin_invoices i where i.id = invoice_id and i.status = 'draft'));

drop trigger if exists fin_audit_trg on fin_customers;
create trigger fin_audit_trg after insert or update or delete on fin_customers for each row execute function fin_audit();
drop trigger if exists fin_audit_trg on fin_invoices;
create trigger fin_audit_trg after insert or update or delete on fin_invoices for each row execute function fin_audit();
drop trigger if exists fin_audit_trg on fin_invoice_lines;
create trigger fin_audit_trg after insert or update or delete on fin_invoice_lines for each row execute function fin_audit();
