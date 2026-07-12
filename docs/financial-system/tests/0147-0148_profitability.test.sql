-- 0147/0148 acceptance — dimension tagging + profitability grouping. Staging with 0116-0148 applied.
-- Rollback; NOTICE. The profitability views are plain views → service-role testable. Seeds a project,
-- posted revenue + direct-cost lines tagged to it, and asserts the margin grouping. UUIDs valid hex.

begin;

insert into companies (id, name) values ('00000000-0000-0000-0000-0000000000c1','ACCEPT Co')
  on conflict (id) do nothing;
insert into fin_settings (company_id, base_currency) values ('00000000-0000-0000-0000-0000000000c1','USD')
  on conflict (company_id) do nothing;
insert into fin_accounts (company_id, code, name, type, normal_balance, cost_type) values
  ('00000000-0000-0000-0000-0000000000c1','1100','Accounts Receivable','asset','debit','none'),
  ('00000000-0000-0000-0000-0000000000c1','2000','Accounts Payable','liability','credit','none'),
  ('00000000-0000-0000-0000-0000000000c1','4000','Revenue','revenue','credit','none'),
  ('00000000-0000-0000-0000-0000000000c1','6000','Direct Labor','expense','debit','direct')
  on conflict (company_id, code) do nothing;
insert into fin_periods (id, company_id, name, start_date, end_date, status)
  values ('00000000-0000-0000-0000-000000000f01','00000000-0000-0000-0000-0000000000c1','2026','2026-01-01','2026-12-31','open')
  on conflict (id) do nothing;
insert into fin_projects (id, company_id, code, name)
  values ('00000000-0000-0000-0000-00000000a001','00000000-0000-0000-0000-0000000000c1','P1','Acme rollout')
  on conflict (id) do nothing;

-- Posted revenue entry: Dr AR 300 / Cr Revenue 300 — the revenue line tagged to project P1.
insert into fin_journal_entries (id, company_id, entry_date, period_id, description, status)
  values ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000c1','2026-07-10','00000000-0000-0000-0000-000000000f01','rev','posted')
  on conflict (id) do nothing;
insert into fin_journal_lines (company_id, entry_id, line_no, account_id, debit, credit, project_id) values
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e1',1,(select id from fin_accounts where company_id='00000000-0000-0000-0000-0000000000c1' and code='1100'),300,0,null),
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e1',2,(select id from fin_accounts where company_id='00000000-0000-0000-0000-0000000000c1' and code='4000'),0,300,'00000000-0000-0000-0000-00000000a001')
  on conflict do nothing;
-- Posted cost entry: Dr Direct Labor 100 (tagged P1) / Cr AP 100.
insert into fin_journal_entries (id, company_id, entry_date, period_id, description, status)
  values ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-0000000000c1','2026-07-11','00000000-0000-0000-0000-000000000f01','cost','posted')
  on conflict (id) do nothing;
insert into fin_journal_lines (company_id, entry_id, line_no, account_id, debit, credit, project_id) values
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e2',1,(select id from fin_accounts where company_id='00000000-0000-0000-0000-0000000000c1' and code='6000'),100,0,'00000000-0000-0000-0000-00000000a001'),
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e2',2,(select id from fin_accounts where company_id='00000000-0000-0000-0000-0000000000c1' and code='2000'),0,100,null)
  on conflict do nothing;

do $$ declare v_rev numeric; v_direct numeric; v_total numeric;
begin
  select revenue, direct_cost, total_cost into v_rev, v_direct, v_total
    from fin_project_profitability where project_id = '00000000-0000-0000-0000-00000000a001';
  if v_rev = 300 then raise notice 'PROFIT PASS: project revenue = 300 (tagged revenue line)';
  else raise notice 'PROFIT FAIL: revenue = % (want 300)', v_rev; end if;
  if v_direct = 100 then raise notice 'PROFIT PASS: direct_cost = 100 (6000 is cost_type=direct, tagged)';
  else raise notice 'PROFIT FAIL: direct_cost = % (want 100)', v_direct; end if;
  if v_total = 100 then raise notice 'PROFIT PASS: total_cost = 100';
  else raise notice 'PROFIT FAIL: total_cost = % (want 100)', v_total; end if;
  if (v_rev - v_total) = 200 then raise notice 'PROFIT PASS: margin = 200 (300 - 100)';
  else raise notice 'PROFIT FAIL: margin = % (want 200)', (v_rev - v_total); end if;
end $$;

rollback;
