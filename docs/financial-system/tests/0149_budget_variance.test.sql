-- 0149 acceptance — budget-vs-actual variance. Staging with 0116-0149 applied. Rollback; NOTICE.
-- fin_budget_variance is a plain view → service-role testable. Seeds a Q1 expense budget + posted
-- actuals in Q1 (counts) and Q2 (must NOT count for the Q1 line), and asserts budget/actual/variance.
-- UUIDs valid hex.

begin;

insert into companies (id, name) values ('00000000-0000-0000-0000-0000000000c1','ACCEPT Co')
  on conflict (id) do nothing;
insert into fin_settings (company_id, base_currency) values ('00000000-0000-0000-0000-0000000000c1','USD')
  on conflict (company_id) do nothing;
insert into fin_accounts (company_id, code, name, type, normal_balance) values
  ('00000000-0000-0000-0000-0000000000c1','6000','Operating Expenses','expense','debit'),
  ('00000000-0000-0000-0000-0000000000c1','2000','Accounts Payable','liability','credit')
  on conflict (company_id, code) do nothing;
insert into fin_periods (id, company_id, name, start_date, end_date, status)
  values ('00000000-0000-0000-0000-000000000f01','00000000-0000-0000-0000-0000000000c1','2026','2026-01-01','2026-12-31','open')
  on conflict (id) do nothing;

-- Budget FY2026 with a Q1 line for 6000 = 1000 (company-wide, cost_center null).
insert into fin_budgets (id, company_id, name, fiscal_year, granularity, status)
  values ('00000000-0000-0000-0000-0000000b0001','00000000-0000-0000-0000-0000000000c1','FY2026','2026','quarterly','active')
  on conflict (id) do nothing;
insert into fin_budget_lines (company_id, budget_id, account_id, cost_center_id, period_index, amount)
  values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000b0001',
          (select id from fin_accounts where company_id='00000000-0000-0000-0000-0000000000c1' and code='6000'),
          null, 1, 1000)
  on conflict do nothing;

-- Posted expense 300 in Q1 (Feb, counts) + 200 in Q2 (May, must NOT count for the Q1 line).
insert into fin_journal_entries (id, company_id, entry_date, period_id, description, status) values
  ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000c1','2026-02-15','00000000-0000-0000-0000-000000000f01','q1 spend','posted'),
  ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-0000000000c1','2026-05-15','00000000-0000-0000-0000-000000000f01','q2 spend','posted')
  on conflict (id) do nothing;
insert into fin_journal_lines (company_id, entry_id, line_no, account_id, debit, credit) values
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e1',1,(select id from fin_accounts where company_id='00000000-0000-0000-0000-0000000000c1' and code='6000'),300,0),
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e1',2,(select id from fin_accounts where company_id='00000000-0000-0000-0000-0000000000c1' and code='2000'),0,300),
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e2',1,(select id from fin_accounts where company_id='00000000-0000-0000-0000-0000000000c1' and code='6000'),200,0),
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e2',2,(select id from fin_accounts where company_id='00000000-0000-0000-0000-0000000000c1' and code='2000'),0,200)
  on conflict do nothing;

do $$ declare v_budget numeric; v_actual numeric;
begin
  select budget, actual into v_budget, v_actual
    from fin_budget_variance where budget_id = '00000000-0000-0000-0000-0000000b0001' and period_index = 1;
  if v_budget = 1000 then raise notice 'BUDGET PASS: Q1 budget = 1000';
  else raise notice 'BUDGET FAIL: budget = % (want 1000)', v_budget; end if;
  -- Only Q1 actual (300) counts; the Q2 200 is excluded by the quarter filter.
  if v_actual = 300 then raise notice 'VARIANCE PASS: Q1 actual = 300 (Q2 200 excluded by quarter filter)';
  else raise notice 'VARIANCE FAIL: actual = % (want 300 — Q2 leaked in?)', v_actual; end if;
  if (v_actual - v_budget) = -700 then raise notice 'VARIANCE PASS: variance = -700 (under budget)';
  else raise notice 'VARIANCE FAIL: variance = % (want -700)', (v_actual - v_budget); end if;
end $$;

rollback;
