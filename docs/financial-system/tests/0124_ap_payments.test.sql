-- 0124 acceptance — AP payments. Staging, 0116-0124 applied. Rollback; NOTICE.
-- Structure is service-role-testable; the pay→GL flow (fin_pay_bill) needs a real approver + open
-- period and is app-layer.

begin;
insert into companies (id, name) values ('00000000-0000-0000-0000-0000000000c1','ACCEPT Co')
  on conflict (id) do nothing;

-- amount must be positive
do $$ begin
  begin
    insert into fin_payments (company_id, amount, payment_date) values ('00000000-0000-0000-0000-0000000000c1', 0, '2026-07-15');
    raise notice 'PAY FAIL: zero-amount payment accepted';
  exception when check_violation then raise notice 'PAY PASS: non-positive payment rejected'; end;
end $$;
rollback;

-- APP-LAYER (real approver + open period): fin_pay_bill posts a BALANCED Dr AP / Cr Cash entry,
-- records the payment + links it, blocks over-payment (cumulative > bill total), marks the bill
-- 'paid' only when fully covered (partial stays 'approved'), and REJECTS foreign-currency
-- settlement (FX-on-payment is a flagged later increment). Only fin_can_approve() may call it.
