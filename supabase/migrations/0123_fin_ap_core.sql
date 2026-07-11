-- 0123 — Financial System, Phase-2 Increment (AP core): vendors + bills → GL
--
-- Accounts Payable, decision-independent of the AR direction. A bill is a SUBLEDGER document; on
-- approval it posts a balanced GL entry via fin_post_system_entry (0122, Decision 1 system-post):
--   Dr expense/asset accounts (line amounts) + Dr Tax Receivable (input tax, capture-only per
--   Decision 2) ; Cr Accounts Payable (grand total). The bill links to its GL entry via
--   fin_source_postings for drill-down + AP-control-account reconciliation.
--
-- Idempotent (A12). Acceptance: docs/financial-system/tests/0123_ap_core.test.sql (structure);
-- the approve→GL flow is app-layer (needs a real approver).

-- Tax Receivable (input/recoverable tax) wasn't in the original seed. Add it to fin_init_company
-- for future inits AND backfill companies that already initialized finance.
create or replace function fin_init_company(p_base_currency char(3) default 'USD')
returns void language plpgsql
security definer set search_path = public as $$
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
    (v_company, '3000', 'Retained Earnings',   'equity',    'credit', true),
    (v_company, '3100', 'Owner Equity',        'equity',    'credit', false),
    (v_company, '4000', 'Revenue',             'revenue',   'credit', false),
    (v_company, '5000', 'Cost of Goods Sold',  'expense',   'debit',  false),
    (v_company, '6000', 'Operating Expenses',  'expense',   'debit',  false),
    (v_company, '7900', 'FX Gain/Loss',        'expense',   'debit',  true)
    on conflict (company_id, code) do nothing;
end $$;

-- Backfill Tax Receivable for already-initialized companies (idempotent).
insert into fin_accounts (company_id, code, name, type, normal_balance, is_system)
select s.company_id, '1200', 'Tax Receivable', 'asset', 'debit', false
from fin_settings s
where not exists (select 1 from fin_accounts a where a.company_id = s.company_id and a.code = '1200');

-- ── Vendor master ──
create table if not exists fin_vendors (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade,
  name         text not null,
  email        text,
  tax_id       text,
  terms_days   int not null default 30,
  default_expense_account_id uuid references fin_accounts(id) on delete set null,
  is_active    boolean not null default true,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint fin_vendors_company_name_uq unique (company_id, name)
);
create index if not exists fin_vendors_company_idx on fin_vendors (company_id);

-- ── Bills (vendor invoices) + lines ──
create table if not exists fin_bills (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references companies(id) on delete cascade,
  vendor_id      uuid not null references fin_vendors(id) on delete restrict,
  bill_number    text not null,
  bill_date      date not null,
  due_date       date,
  currency       char(3),
  status         text not null default 'draft' check (status in ('draft','approved','paid','void')),
  memo           text,
  posted_entry_id uuid references fin_journal_entries(id) on delete restrict,
  created_by     uuid references auth.users(id) on delete set null,
  approved_by    uuid references auth.users(id) on delete set null,
  approved_at    timestamptz,
  created_at     timestamptz not null default now(),
  constraint fin_bills_vendor_number_uq unique (company_id, vendor_id, bill_number)
);
create index if not exists fin_bills_company_status_idx on fin_bills (company_id, status);

create table if not exists fin_bill_lines (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  bill_id     uuid not null references fin_bills(id) on delete cascade,
  line_no     int not null,
  account_id  uuid not null references fin_accounts(id) on delete restrict,  -- expense/asset
  description text,
  amount      numeric(19,4) not null check (amount >= 0),
  tax_amount  numeric(19,4) not null default 0 check (tax_amount >= 0)
);
create index if not exists fin_bill_lines_bill_idx on fin_bill_lines (bill_id);

-- ── fin_approve_bill: approve a draft bill → post the GL entry (Decision 1 system-post) ──
create or replace function fin_approve_bill(p_bill_id uuid)
returns uuid language plpgsql
security definer set search_path = public as $$
declare
  v_company uuid; v_status text; v_ccy char(3); v_date date; v_vendor uuid;
  v_period uuid; v_ap uuid; v_taxrec uuid; v_lines jsonb; v_tax numeric(19,4); v_entry uuid;
begin
  if not fin_can_approve() then raise exception 'Not authorized to approve bills'; end if;
  select company_id, status, currency, bill_date, vendor_id
    into v_company, v_status, v_ccy, v_date, v_vendor
    from fin_bills where id = p_bill_id;
  if v_company is null or v_company <> auth_company_id() then raise exception 'Bill not found in your company'; end if;
  if v_status <> 'draft' then raise exception 'Only a draft bill can be approved (current: %)', v_status; end if;

  -- the open period covering the bill date
  select id into v_period from fin_periods
    where company_id = v_company and status = 'open' and v_date between start_date and end_date
    order by start_date desc limit 1;
  if v_period is null then raise exception 'No OPEN period covers the bill date %', v_date; end if;

  v_ap     := fin_account_by_code(v_company, '2000');   -- Accounts Payable
  v_taxrec := fin_account_by_code(v_company, '1200');   -- Tax Receivable
  if v_ap is null then raise exception 'Accounts Payable account (2000) missing — initialize finance'; end if;

  -- Build the GL lines: one Dr per bill line (amount) + a single Dr Tax Receivable (sum tax) +
  -- one Cr Accounts Payable (grand total). All in the bill currency; the line trigger converts.
  select coalesce(jsonb_agg(jsonb_build_object(
           'account_id', account_id, 'debit', amount, 'credit', 0, 'currency', v_ccy,
           'memo', coalesce(description,'')) order by line_no), '[]'::jsonb),
         coalesce(sum(tax_amount), 0)
    into v_lines, v_tax
    from fin_bill_lines where bill_id = p_bill_id;

  if jsonb_array_length(v_lines) = 0 then raise exception 'Bill has no lines'; end if;

  if v_tax > 0 then
    if v_taxrec is null then raise exception 'Tax Receivable account (1200) missing'; end if;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'account_id', v_taxrec, 'debit', v_tax, 'credit', 0, 'currency', v_ccy, 'memo', 'Input tax'));
  end if;

  -- Cr Accounts Payable for the grand total (line amounts + tax)
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

-- ── RLS ──
alter table fin_vendors    enable row level security;
alter table fin_bills      enable row level security;
alter table fin_bill_lines enable row level security;

drop policy if exists "fin_vendors - select" on fin_vendors;
create policy "fin_vendors - select" on fin_vendors for select using (company_id = auth_company_id() and fin_can_view());
drop policy if exists "fin_vendors - write" on fin_vendors;
create policy "fin_vendors - write" on fin_vendors for all using (company_id = auth_company_id() and fin_can_enter()) with check (company_id = auth_company_id() and fin_can_enter());

drop policy if exists "fin_bills - select" on fin_bills;
create policy "fin_bills - select" on fin_bills for select using (company_id = auth_company_id() and fin_can_view());
-- Create/edit DRAFT bills with enter-capability; approval + the GL post go through fin_approve_bill.
drop policy if exists "fin_bills - write" on fin_bills;
create policy "fin_bills - write" on fin_bills for all using (company_id = auth_company_id() and fin_can_enter()) with check (company_id = auth_company_id() and fin_can_enter());

drop policy if exists "fin_bill_lines - select" on fin_bill_lines;
create policy "fin_bill_lines - select" on fin_bill_lines for select using (company_id = auth_company_id() and fin_can_view());
drop policy if exists "fin_bill_lines - write" on fin_bill_lines;
create policy "fin_bill_lines - write" on fin_bill_lines for all using (company_id = auth_company_id() and fin_can_enter()) with check (company_id = auth_company_id() and fin_can_enter());

-- audit
drop trigger if exists fin_audit_trg on fin_vendors;
create trigger fin_audit_trg after insert or update or delete on fin_vendors for each row execute function fin_audit();
drop trigger if exists fin_audit_trg on fin_bills;
create trigger fin_audit_trg after insert or update or delete on fin_bills for each row execute function fin_audit();
drop trigger if exists fin_audit_trg on fin_bill_lines;
create trigger fin_audit_trg after insert or update or delete on fin_bill_lines for each row execute function fin_audit();

-- FLAGGED (Decision needed, not silently built): spend-limit approval thresholds (an approver can
-- approve up to $X, above escalates to controller/cfo) — needs the threshold values from you.
-- Payments (Dr AP, Cr Cash + FX gain/loss) are the next AP increment. Bills currently support
-- draft→approved; 'paid' is set by the payments increment.
