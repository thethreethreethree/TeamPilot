-- 0127 — Financial System hardening: fin_pay_bill must lock the bill (over-payment race)
--
-- Adversarial self-audit: fin_pay_bill (0124) read cumulative payments WITHOUT locking the bill, so
-- two concurrent payments could each pass the "cumulative <= total" check and TOGETHER over-pay.
-- For a payments path that must never over-pay, serialize on the bill row: SELECT … FOR UPDATE.
-- Everything else is identical to 0124's function.
--
-- Idempotent (create or replace).

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
  -- LOCK the bill row for the duration of the transaction so concurrent payments serialize.
  select company_id, status, currency, vendor_id into v_company, v_status, v_ccy, v_vendor
    from fin_bills where id = p_bill_id for update;
  if v_company is null or v_company <> auth_company_id() then raise exception 'Bill not found in your company'; end if;
  if v_status not in ('approved') then raise exception 'Only an approved (unpaid/partly-paid) bill can be paid (current: %)', v_status; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Payment amount must be positive'; end if;

  select base_currency into v_base from fin_settings where company_id = v_company;
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

  select coalesce(sum(amount + tax_amount),0) into v_total from fin_bill_lines where bill_id = p_bill_id;
  select coalesce(sum(amount),0) into v_paid from fin_payments where bill_id = p_bill_id;
  if v_paid + p_amount > v_total then
    raise exception 'Payment % exceeds the outstanding balance % on this bill', p_amount, v_total - v_paid;
  end if;

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

  if v_paid + p_amount >= v_total then
    update fin_bills set status = 'paid' where id = p_bill_id;
  end if;
  return v_entry;
end $$;
