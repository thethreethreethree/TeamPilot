-- 0119 acceptance tests — multi-currency. Staging, 0116-0119 applied. Rollback; NOTICE PASS/FAIL.
-- Conversion + rounding + rate lookup are service-role-testable (the line trigger computes base
-- amounts on insert). The RPC-gated fin_init_company / rate-write authority are app-layer.

begin;

insert into companies (id, name) values ('00000000-0000-0000-0000-0000000000c1','ACCEPT Co')
  on conflict (id) do nothing;
insert into fin_settings (company_id, base_currency) values ('00000000-0000-0000-0000-0000000000c1','USD')
  on conflict (company_id) do nothing;
insert into fin_periods (id, company_id, name, start_date, end_date, status)
  values ('00000000-0000-0000-0000-0000000000p1','00000000-0000-0000-0000-0000000000c1','2026-07','2026-07-01','2026-07-31','open')
  on conflict (id) do nothing;
insert into fin_accounts (id, company_id, code, name, type, normal_balance) values
  ('00000000-0000-0000-0000-00000000ac01','00000000-0000-0000-0000-0000000000c1','1000','Cash','asset','debit'),
  ('00000000-0000-0000-0000-00000000ac02','00000000-0000-0000-0000-0000000000c1','4000','Revenue','revenue','credit')
  on conflict (id) do nothing;
insert into fin_exchange_rates (company_id, from_currency, to_currency, rate, as_of_date)
  values ('00000000-0000-0000-0000-0000000000c1','EUR','USD',1.08500000,'2026-07-01')
  on conflict do nothing;

-- fin_get_rate
do $$ declare r numeric; begin
  r := fin_get_rate('00000000-0000-0000-0000-0000000000c1','EUR','USD','2026-07-15');
  if r = 1.085 then raise notice 'RATE PASS: EUR->USD as-of resolves to 1.0850'; else raise notice 'RATE FAIL: got %', r; end if;
  r := fin_get_rate('00000000-0000-0000-0000-0000000000c1','USD','USD','2026-07-15');
  if r = 1 then raise notice 'RATE PASS: same-currency = 1'; else raise notice 'RATE FAIL same-ccy: %', r; end if;
  r := fin_get_rate('00000000-0000-0000-0000-0000000000c1','GBP','USD','2026-07-15');
  if r is null then raise notice 'RATE PASS: unknown pair = null'; else raise notice 'RATE FAIL unknown: %', r; end if;
end $$;

-- T-23 / T-24: a EUR line's base amount is round(face * rate, 4)
do $$ declare e uuid; v numeric; begin
  insert into fin_journal_entries (company_id, entry_date, period_id, description)
    values ('00000000-0000-0000-0000-0000000000c1','2026-07-15','00000000-0000-0000-0000-0000000000p1','fx test')
    returning id into e;
  insert into fin_journal_lines (company_id, entry_id, line_no, account_id, debit, credit, currency)
    values ('00000000-0000-0000-0000-0000000000c1', e, 1, '00000000-0000-0000-0000-00000000ac01', 100, 0, 'EUR');
  select base_debit into v from fin_journal_lines where entry_id = e and line_no = 1;
  if v = 108.5000 then raise notice 'T-23 PASS: 100 EUR * 1.0850 = 108.5000 base'; else raise notice 'T-23 FAIL: base_debit = %', v; end if;
end $$;

-- T-22: an entry balances in BASE even when line currencies differ.
-- 100 EUR debit (=108.50 base) + 108.50 USD credit (=108.50 base) → balances in base.
do $$ declare e uuid; d numeric; c numeric; begin
  insert into fin_journal_entries (company_id, entry_date, period_id, description)
    values ('00000000-0000-0000-0000-0000000000c1','2026-07-15','00000000-0000-0000-0000-0000000000p1','mixed ccy')
    returning id into e;
  insert into fin_journal_lines (company_id, entry_id, line_no, account_id, debit, credit, currency) values
    ('00000000-0000-0000-0000-0000000000c1', e, 1, '00000000-0000-0000-0000-00000000ac01', 100, 0, 'EUR'),
    ('00000000-0000-0000-0000-0000000000c1', e, 2, '00000000-0000-0000-0000-00000000ac02', 0, 108.50, 'USD');
  select sum(base_debit), sum(base_credit) into d, c from fin_journal_lines where entry_id = e;
  if d = c then raise notice 'T-22 PASS: mixed-currency entry balances in base (% = %)', d, c;
  else raise notice 'T-22 FAIL: base debit % <> credit %', d, c; end if;
end $$;

rollback;

-- APP-LAYER: fin_init_company authority + COA seed; rate-write authority (configure-level);
-- the "no rate -> post rejected" path through the real flow; T-2 RLS isolation on fin_exchange_rates.
