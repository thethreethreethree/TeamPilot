-- 0144 acceptance — date-range / as-of aggregation semantics. Staging with 0116-0144 applied.
-- Rollback; NOTICE. fin_statements itself is auth-gated (security invoker + auth_company_id → empty
-- under service role), so this verifies the DATE-FILTER LOGIC it uses, on seeded posted entries: the
-- P&L range predicate picks in-range entries; the as-of predicate picks entries through the end date.
-- The predicates below MIRROR fin_statements' `period` (range) and `asof` CTEs — keep them in sync.
-- UUIDs valid hex.

begin;

insert into companies (id, name) values ('00000000-0000-0000-0000-0000000000c1','ACCEPT Co')
  on conflict (id) do nothing;
insert into fin_settings (company_id, base_currency) values ('00000000-0000-0000-0000-0000000000c1','USD')
  on conflict (company_id) do nothing;
insert into fin_accounts (company_id, code, name, type, normal_balance) values
  ('00000000-0000-0000-0000-0000000000c1','1100','Accounts Receivable','asset','debit'),
  ('00000000-0000-0000-0000-0000000000c1','4000','Revenue','revenue','credit')
  on conflict (company_id, code) do nothing;
insert into fin_periods (id, company_id, name, start_date, end_date, status)
  values ('00000000-0000-0000-0000-000000000f01','00000000-0000-0000-0000-0000000000c1','2026','2026-01-01','2026-12-31','open')
  on conflict (id) do nothing;

-- Two posted entries, different dates: Jan revenue 100, Mar revenue 200 (each balanced Dr AR / Cr Rev).
insert into fin_journal_entries (id, company_id, entry_date, period_id, description, status) values
  ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000c1','2026-01-15','00000000-0000-0000-0000-000000000f01','Jan sale','posted'),
  ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-0000000000c1','2026-03-15','00000000-0000-0000-0000-000000000f01','Mar sale','posted')
  on conflict (id) do nothing;
insert into fin_journal_lines (company_id, entry_id, line_no, account_id, debit, credit) values
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e1',1,(select id from fin_accounts where company_id='00000000-0000-0000-0000-0000000000c1' and code='1100'),100,0),
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e1',2,(select id from fin_accounts where company_id='00000000-0000-0000-0000-0000000000c1' and code='4000'),0,100),
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e2',1,(select id from fin_accounts where company_id='00000000-0000-0000-0000-0000000000c1' and code='1100'),200,0),
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e2',2,(select id from fin_accounts where company_id='00000000-0000-0000-0000-0000000000c1' and code='4000'),0,200)
  on conflict do nothing;

-- Revenue over a range = Σ(credit-debit) for revenue lines whose entry_date is in [from,to].
create or replace function pg_temp.rev_between(p_from date, p_to date) returns numeric language sql stable as $$
  select coalesce(sum(l.base_credit - l.base_debit),0)
  from fin_journal_lines l join fin_journal_entries e on e.id = l.entry_id
  join fin_accounts a on a.id = l.account_id
  where a.company_id='00000000-0000-0000-0000-0000000000c1' and a.type='revenue' and e.status='posted'
    and (p_from is null or e.entry_date >= p_from) and (p_to is null or e.entry_date <= p_to);
$$;

do $$ begin
  -- P&L range: Jan only.
  if pg_temp.rev_between('2026-01-01','2026-01-31') = 100 then raise notice 'RANGE PASS: Jan-only revenue = 100';
  else raise notice 'RANGE FAIL: Jan-only = % (want 100)', pg_temp.rev_between('2026-01-01','2026-01-31'); end if;
  -- P&L range: Q1 = both.
  if pg_temp.rev_between('2026-01-01','2026-03-31') = 300 then raise notice 'RANGE PASS: Q1 revenue = 300 (both)';
  else raise notice 'RANGE FAIL: Q1 = % (want 300)', pg_temp.rev_between('2026-01-01','2026-03-31'); end if;
  -- as-of end-Feb: Jan only (Mar not yet).
  if pg_temp.rev_between(null,'2026-02-28') = 100 then raise notice 'ASOF PASS: as-of 2026-02-28 revenue = 100';
  else raise notice 'ASOF FAIL: as-of Feb = % (want 100)', pg_temp.rev_between(null,'2026-02-28'); end if;
  -- as-of end-Mar: both.
  if pg_temp.rev_between(null,'2026-03-31') = 300 then raise notice 'ASOF PASS: as-of 2026-03-31 revenue = 300';
  else raise notice 'ASOF FAIL: as-of Mar = % (want 300)', pg_temp.rev_between(null,'2026-03-31'); end if;
  -- all-time (both null): both.
  if pg_temp.rev_between(null,null) = 300 then raise notice 'ALLTIME PASS: null,null = 300 (= pre-0144 behaviour)';
  else raise notice 'ALLTIME FAIL: null,null = % (want 300)', pg_temp.rev_between(null,null); end if;
end $$;

rollback;
