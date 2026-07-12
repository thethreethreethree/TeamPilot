-- 0129 acceptance — config-immutability guards. Staging, 0116-0129 applied. Rollback; NOTICE.
-- Trigger-based (no auth needed) → fully service-role-testable. Verifies base_currency + account
-- type/normal_balance freeze once postings depend on them.

begin;

insert into companies (id, name) values ('00000000-0000-0000-0000-0000000000c1','ACCEPT Co')
  on conflict (id) do nothing;
insert into fin_settings (company_id, base_currency) values ('00000000-0000-0000-0000-0000000000c1','USD')
  on conflict (company_id) do nothing;
insert into fin_periods (id, company_id, name, start_date, end_date, status)
  values ('00000000-0000-0000-0000-0000000000p1','00000000-0000-0000-0000-0000000000c1','2026','2026-01-01','2026-12-31','open')
  on conflict (id) do nothing;
insert into fin_accounts (id, company_id, code, name, type, normal_balance) values
  ('00000000-0000-0000-0000-00000000ac01','00000000-0000-0000-0000-0000000000c1','1000','Cash','asset','debit'),
  ('00000000-0000-0000-0000-00000000ac02','00000000-0000-0000-0000-0000000000c1','4000','Revenue','revenue','credit')
  on conflict (id) do nothing;

-- Before any entry: base_currency + account type ARE editable (guards only bite once used).
do $$ begin
  update fin_settings set base_currency='EUR' where company_id='00000000-0000-0000-0000-0000000000c1';
  update fin_settings set base_currency='USD' where company_id='00000000-0000-0000-0000-0000000000c1';
  raise notice 'PRE PASS: base_currency editable before any journal entry';
end $$;

-- Post a balanced entry (direct, service role) so the guards engage.
insert into fin_journal_entries (id, company_id, entry_date, period_id, description, status)
  values ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000c1','2026-07-15','00000000-0000-0000-0000-0000000000p1','seed','posted');
insert into fin_journal_lines (company_id, entry_id, line_no, account_id, debit, credit) values
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e1',1,'00000000-0000-0000-0000-00000000ac01',100,0),
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e1',2,'00000000-0000-0000-0000-00000000ac02',0,100);

-- Now base_currency is FROZEN (entries exist).
do $$ begin
  begin
    update fin_settings set base_currency='EUR' where company_id='00000000-0000-0000-0000-0000000000c1';
    raise notice 'CCY FAIL: base_currency changed after entries exist';
  exception when others then raise notice 'CCY PASS: base_currency change rejected once entries exist (%).', sqlerrm; end;
end $$;

-- And the Cash account (which now has lines) can't change type/normal_balance.
do $$ begin
  begin
    update fin_accounts set type='expense', normal_balance='debit' where id='00000000-0000-0000-0000-00000000ac01';
    raise notice 'ACCT FAIL: account type changed after it has lines';
  exception when others then raise notice 'ACCT PASS: account type change rejected once it has lines (%).', sqlerrm; end;
  -- but a benign field (name) is still editable
  update fin_accounts set name='Cash — Operating' where id='00000000-0000-0000-0000-00000000ac01';
  raise notice 'ACCT PASS: benign field (name) still editable';
end $$;

rollback;
