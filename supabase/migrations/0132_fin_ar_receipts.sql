-- 0132 — Financial System, AR receipts: record payment against an invoice → GL (Dr Cash / Cr AR)
--
-- Completes the AR money-in flow. Recording a receipt against a sent invoice posts Dr Cash / Cr
-- Accounts Receivable via the 0122 primitive, records it, and marks the invoice paid (or leaves it
-- 'sent' if partial). Built with both AP-audit lessons from the start: FOR UPDATE lock (over-receipt
-- race) and base-currency-only (foreign FX-on-settlement deferred, rejected not mis-posted).
--
-- Idempotent (A12). Acceptance: docs/financial-system/tests/0132_ar_receipts.test.sql (structure);
-- the receipt→GL flow is app-layer.

create table if not exists fin_receipts (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  customer_id     uuid references fin_customers(id) on delete set null,
  invoice_id      uuid references fin_invoices(id) on delete set null,
  amount          numeric(19,4) not null check (amount > 0),
  currency        char(3),
  receipt_date    date not null,
  cash_account_id uuid references fin_accounts(id) on delete restrict,
  posted_entry_id uuid references fin_journal_entries(id) on delete restrict,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index if not exists fin_receipts_company_idx on fin_receipts (company_id);
create index if not exists fin_receipts_invoice_idx on fin_receipts (invoice_id);

create or replace function fin_record_receipt(
  p_invoice_id uuid, p_amount numeric, p_receipt_date date, p_cash_code text default '1000'
) returns uuid language plpgsql
security definer set search_path = public as $$
declare
  v_company uuid; v_status text; v_ccy char(3); v_customer uuid; v_base char(3);
  v_period uuid; v_ar uuid; v_cash uuid; v_total numeric(19,4); v_received numeric(19,4);
  v_entry uuid; v_rcpt uuid;
begin
  if not fin_can_approve() then raise exception 'Not authorized to record receipts'; end if;
  -- Lock the invoice so concurrent receipts serialize (over-receipt guard).
  select company_id, status, currency, customer_id into v_company, v_status, v_ccy, v_customer
    from fin_invoices where id = p_invoice_id for update;
  if v_company is null or v_company <> auth_company_id() then raise exception 'Invoice not found in your company'; end if;
  if v_status <> 'sent' then raise exception 'Only a sent (unpaid/partly-paid) invoice can receive a payment (current: %)', v_status; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Receipt amount must be positive'; end if;

  select base_currency into v_base from fin_settings where company_id = v_company;
  if coalesce(v_ccy, v_base) is distinct from coalesce(v_base,'USD') then
    raise exception 'Foreign-currency settlement (invoice currency %) realizes FX gain/loss vs the booking rate — that increment is not built yet. Base-currency receipts only for now.', v_ccy;
  end if;

  select id into v_period from fin_periods
    where company_id = v_company and status = 'open' and p_receipt_date between start_date and end_date
    order by start_date desc limit 1;
  if v_period is null then raise exception 'No OPEN period covers the receipt date %', p_receipt_date; end if;

  v_ar   := fin_account_by_code(v_company, '1100');
  v_cash := fin_account_by_code(v_company, p_cash_code);
  if v_ar is null or v_cash is null then raise exception 'AR (1100) or cash account (%) missing', p_cash_code; end if;

  select coalesce(sum(amount + tax_amount),0) into v_total from fin_invoice_lines where invoice_id = p_invoice_id;
  select coalesce(sum(amount),0) into v_received from fin_receipts where invoice_id = p_invoice_id;
  if v_received + p_amount > v_total then
    raise exception 'Receipt % exceeds the outstanding balance % on this invoice', p_amount, v_total - v_received;
  end if;

  v_entry := fin_post_system_entry(v_company, p_receipt_date, v_period,
    'Receipt for invoice ' || (select invoice_number from fin_invoices where id = p_invoice_id), 'payment',
    jsonb_build_array(
      jsonb_build_object('account_id', v_cash, 'debit', p_amount, 'credit', 0, 'currency', v_base, 'memo', 'Cash in'),
      jsonb_build_object('account_id', v_ar,   'debit', 0, 'credit', p_amount, 'currency', v_base, 'memo', 'AR settled')
    ));

  insert into fin_receipts (company_id, customer_id, invoice_id, amount, currency, receipt_date, cash_account_id, posted_entry_id, created_by)
    values (v_company, v_customer, p_invoice_id, p_amount, v_base, p_receipt_date, v_cash, v_entry, auth.uid())
    returning id into v_rcpt;
  insert into fin_source_postings (company_id, source_type, source_id, entry_id, kind)
    values (v_company, 'ar_receipt', v_rcpt, v_entry, 'payment');

  if v_received + p_amount >= v_total then
    update fin_invoices set status = 'paid' where id = p_invoice_id;
  end if;
  return v_entry;
end $$;

alter table fin_receipts enable row level security;
drop policy if exists "fin_receipts - select" on fin_receipts;
create policy "fin_receipts - select" on fin_receipts for select using (company_id = auth_company_id() and fin_can_view());
-- Created only through fin_record_receipt (SECURITY DEFINER); no client write policy.

drop trigger if exists fin_audit_trg on fin_receipts;
create trigger fin_audit_trg after insert or update or delete on fin_receipts for each row execute function fin_audit();
