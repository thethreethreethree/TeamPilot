-- 0124 — Financial System, Phase-2 (AP payments): pay a bill → GL (Dr AP, Cr Cash)
--
-- Completes the AP money-out flow. Paying an approved bill posts Dr Accounts Payable / Cr Cash via
-- the 0122 primitive, records the payment, and marks the bill paid (or leaves it approved if the
-- cumulative payments don't yet cover the total — partial payment).
--
-- SCOPE (honest): base-currency settlement only. Foreign-currency payments realize FX gain/loss vs
-- the bill's ORIGINAL booking rate — that needs the booking-rate reconstruction and is a FLAGGED
-- follow-up increment. Rather than post wrong numbers, fin_pay_bill REJECTS a payment whose
-- resolution would require FX, with a clear message.
--
-- Idempotent (A12). Acceptance: docs/financial-system/tests/0124_ap_payments.test.sql (structure);
-- the pay→GL flow is app-layer.

create table if not exists fin_payments (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references companies(id) on delete cascade,
  vendor_id      uuid references fin_vendors(id) on delete set null,
  bill_id        uuid references fin_bills(id) on delete set null,
  amount         numeric(19,4) not null check (amount > 0),
  currency       char(3),
  payment_date   date not null,
  method         text,
  cash_account_id uuid references fin_accounts(id) on delete restrict,
  posted_entry_id uuid references fin_journal_entries(id) on delete restrict,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists fin_payments_company_idx on fin_payments (company_id);
create index if not exists fin_payments_bill_idx on fin_payments (bill_id);

-- Pay (all or part of) an approved bill. cash_account defaults to Cash (1000).
create or replace function fin_pay_bill(
  p_bill_id uuid, p_amount numeric, p_payment_date date, p_cash_code text default '1000'
) returns uuid language plpgsql
security definer set search_path = public as $$
declare
  v_company uuid; v_status text; v_ccy char(3); v_vendor uuid; v_base char(3);
  v_period uuid; v_ap uuid; v_cash uuid; v_total numeric(19,4); v_paid numeric(19,4);
  v_entry uuid; v_pay uuid;
begin
  if not fin_can_approve() then raise exception 'Not authorized to pay bills'; end if;
  select company_id, status, currency, vendor_id into v_company, v_status, v_ccy, v_vendor
    from fin_bills where id = p_bill_id;
  if v_company is null or v_company <> auth_company_id() then raise exception 'Bill not found in your company'; end if;
  if v_status not in ('approved') then raise exception 'Only an approved (unpaid/partly-paid) bill can be paid (current: %)', v_status; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Payment amount must be positive'; end if;

  select base_currency into v_base from fin_settings where company_id = v_company;
  -- FX-on-payment (foreign bill or foreign cash) is a flagged later increment — reject, don't guess.
  if coalesce(v_ccy, v_base) is distinct from coalesce(v_base,'USD') then
    raise exception 'Foreign-currency settlement (bill currency %) realizes FX gain/loss vs the booking rate — that increment is not built yet. Base-currency payments only for now.', v_ccy;
  end if;

  select id into v_period from fin_periods
    where company_id = v_company and status = 'open' and p_payment_date between start_date and end_date
    order by start_date desc limit 1;
  if v_period is null then raise exception 'No OPEN period covers the payment date %', p_payment_date; end if;

  v_ap   := fin_account_by_code(v_company, '2000');
  v_cash := fin_account_by_code(v_company, p_cash_code);
  if v_ap is null or v_cash is null then raise exception 'AP (2000) or cash account (%) missing', p_cash_code; end if;

  -- Don't over-pay: cumulative payments must not exceed the bill total.
  select coalesce(sum(amount + tax_amount),0) into v_total from fin_bill_lines where bill_id = p_bill_id;
  select coalesce(sum(amount),0) into v_paid from fin_payments where bill_id = p_bill_id;
  if v_paid + p_amount > v_total then
    raise exception 'Payment % exceeds the outstanding balance % on this bill', p_amount, v_total - v_paid;
  end if;

  -- Post Dr AP / Cr Cash for the payment amount.
  v_entry := fin_post_system_entry(v_company, p_payment_date, v_period,
    'Payment for bill ' || (select bill_number from fin_bills where id = p_bill_id), 'payment',
    jsonb_build_array(
      jsonb_build_object('account_id', v_ap,   'debit', p_amount, 'credit', 0, 'currency', v_base, 'memo', 'AP settled'),
      jsonb_build_object('account_id', v_cash, 'debit', 0, 'credit', p_amount, 'currency', v_base, 'memo', 'Cash out')
    ));

  insert into fin_payments (company_id, vendor_id, bill_id, amount, currency, payment_date, cash_account_id, posted_entry_id, created_by)
    values (v_company, v_vendor, p_bill_id, p_amount, v_base, p_payment_date, v_cash, v_entry, auth.uid())
    returning id into v_pay;
  insert into fin_source_postings (company_id, source_type, source_id, entry_id, kind)
    values (v_company, 'ap_payment', v_pay, v_entry, 'payment');

  -- Fully paid?
  if v_paid + p_amount >= v_total then
    update fin_bills set status = 'paid' where id = p_bill_id;
  end if;
  return v_entry;
end $$;

alter table fin_payments enable row level security;
drop policy if exists "fin_payments - select" on fin_payments;
create policy "fin_payments - select" on fin_payments for select using (company_id = auth_company_id() and fin_can_view());
-- Payments are created ONLY through fin_pay_bill (SECURITY DEFINER); no direct client write policy.

drop trigger if exists fin_audit_trg on fin_payments;
create trigger fin_audit_trg after insert or update or delete on fin_payments for each row execute function fin_audit();
