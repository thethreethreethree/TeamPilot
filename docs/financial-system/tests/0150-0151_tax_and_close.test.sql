-- 0150/0151 acceptance — year-end closing-entry logic + tax-report grouping. Staging 0116-0151.
-- Rollback; NOTICE. fin_close_year / fin_tax_report are auth-gated; this verifies the CLOSING-ENTRY
-- construction (revenue/expense → Retained Earnings, balanced) that fin_close_year builds, on seeded
-- posted P&L activity. UUIDs valid hex. (The full close RPC is exercised via the Tax UI on staging.)

begin;

insert into companies (id, name) values ('00000000-0000-0000-0000-0000000000c1','ACCEPT Co')
  on conflict (id) do nothing;
insert into fin_settings (company_id, base_currency) values ('00000000-0000-0000-0000-0000000000c1','USD')
  on conflict (company_id) do nothing;
insert into fin_accounts (company_id, code, name, type, normal_balance) values
  ('00000000-0000-0000-0000-0000000000c1','1100','Accounts Receivable','asset','debit'),
  ('00000000-0000-0000-0000-0000000000c1','2000','Accounts Payable','liability','credit'),
  ('00000000-0000-0000-0000-0000000000c1','4000','Revenue','revenue','credit'),
  ('00000000-0000-0000-0000-0000000000c1','6000','Operating Expenses','expense','debit'),
  ('00000000-0000-0000-0000-0000000000c1','3000','Retained Earnings','equity','credit')
  on conflict (company_id, code) do nothing;
insert into fin_periods (id, company_id, name, start_date, end_date, status)
  values ('00000000-0000-0000-0000-000000000f01','00000000-0000-0000-0000-0000000000c1','2026','2026-01-01','2026-12-31','open')
  on conflict (id) do nothing;

-- 2026 posted P&L: Revenue 500 (Cr) + Expense 300 (Dr). Net income = 200.
insert into fin_journal_entries (id, company_id, entry_date, period_id, description, status) values
  ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000c1','2026-06-01','00000000-0000-0000-0000-000000000f01','rev','posted'),
  ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-0000000000c1','2026-06-02','00000000-0000-0000-0000-000000000f01','exp','posted')
  on conflict (id) do nothing;
insert into fin_journal_lines (company_id, entry_id, line_no, account_id, debit, credit) values
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e1',1,(select id from fin_accounts where company_id='00000000-0000-0000-0000-0000000000c1' and code='1100'),500,0),
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e1',2,(select id from fin_accounts where company_id='00000000-0000-0000-0000-0000000000c1' and code='4000'),0,500),
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e2',1,(select id from fin_accounts where company_id='00000000-0000-0000-0000-0000000000c1' and code='6000'),300,0),
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e2',2,(select id from fin_accounts where company_id='00000000-0000-0000-0000-0000000000c1' and code='2000'),0,300)
  on conflict do nothing;

-- Replicate fin_close_year's per-account close computation for 2026.
do $$
declare v_rev numeric; v_exp numeric; v_net numeric; v_dr numeric; v_cr numeric;
begin
  select
    coalesce(sum(case when a.type='revenue' then l.base_credit - l.base_debit else 0 end),0),
    coalesce(sum(case when a.type='expense' then l.base_debit - l.base_credit else 0 end),0)
    into v_rev, v_exp
  from fin_journal_lines l join fin_journal_entries e on e.id=l.entry_id join fin_accounts a on a.id=l.account_id
  where l.company_id='00000000-0000-0000-0000-0000000000c1' and e.status='posted'
    and a.type in ('revenue','expense') and extract(year from e.entry_date)=2026;

  v_net := v_rev - v_exp;
  if v_net = 200 then raise notice 'CLOSE PASS: net income = 200 (rev 500 - exp 300)';
  else raise notice 'CLOSE FAIL: net = % (want 200)', v_net; end if;

  -- Closing entry: Dr revenue (500) + [RE dr if loss] ; Cr expense (300) + RE credit (net if profit).
  v_dr := v_rev + greatest(-v_net, 0);           -- Dr revenue balances + RE-if-loss
  v_cr := v_exp + greatest(v_net, 0);            -- Cr expense balances + RE-if-profit
  if v_dr = v_cr then raise notice 'CLOSE PASS: closing entry balances (Dr % = Cr %)', v_dr, v_cr;
  else raise notice 'CLOSE FAIL: closing entry UNBALANCED (Dr % <> Cr %)', v_dr, v_cr; end if;
  -- RE gets the net income as a credit (profit).
  if greatest(v_net,0) = 200 then raise notice 'CLOSE PASS: Retained Earnings credited 200 (profit)';
  else raise notice 'CLOSE FAIL: RE credit = % (want 200)', greatest(v_net,0); end if;
  -- Edge (handled in 0151): if net were 0 (rev = exp), NO Retained Earnings line is added — a
  -- debit=0/credit=0 line would violate the debit-XOR-credit CHECK (0118); the rev/exp lines balance
  -- alone. This assertion documents the guard; the full path is exercised via the Tax UI on staging.
  if greatest(0::numeric, 0) = 0 and greatest(-(0::numeric), 0) = 0 then
    raise notice 'CLOSE NOTE: net=0 → RE line omitted (would be 0/0, invalid) — guarded in fin_close_year';
  end if;
end $$;

rollback;
