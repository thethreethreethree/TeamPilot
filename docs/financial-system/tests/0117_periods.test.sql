-- 0117 acceptance tests — Fiscal periods. Run on staging with 0116+0117 applied.
-- Rollback transaction; RAISE NOTICE PASS/FAIL. Covers the pure-DB invariants (T-20, date/name
-- constraints). The close/reopen/lock RPCs and their authority gates need a real authenticated
-- user (fin_can_manage_periods reads auth.uid) — asserted at the app layer (see bottom).

begin;

insert into companies (id, name)
  values ('00000000-0000-0000-0000-0000000000c1', 'ACCEPT-TEST Co')
  on conflict (id) do nothing;

-- valid first period
insert into fin_periods (company_id, name, start_date, end_date)
  values ('00000000-0000-0000-0000-0000000000c1', '2026-07', '2026-07-01', '2026-07-31');

-- T-20: an overlapping period is rejected
do $$
begin
  begin
    insert into fin_periods (company_id, name, start_date, end_date)
      values ('00000000-0000-0000-0000-0000000000c1', '2026-07-overlap', '2026-07-15', '2026-08-15');
    raise notice 'T-20 FAIL: overlapping period was ACCEPTED';
  exception when others then
    raise notice 'T-20 PASS: overlapping period rejected (%).', sqlerrm;
  end;

  -- an ADJACENT, non-overlapping period is accepted
  insert into fin_periods (company_id, name, start_date, end_date)
    values ('00000000-0000-0000-0000-0000000000c1', '2026-08', '2026-08-01', '2026-08-31');
  raise notice 'T-20 PASS: adjacent non-overlapping period accepted';
end $$;

-- dates CHECK: end before start rejected
do $$
begin
  begin
    insert into fin_periods (company_id, name, start_date, end_date)
      values ('00000000-0000-0000-0000-0000000000c1', 'bad-dates', '2026-09-30', '2026-09-01');
    raise notice 'DATES FAIL: end<start was ACCEPTED';
  exception when check_violation then
    raise notice 'DATES PASS: end<start rejected';
  end;
end $$;

-- unique name per company
do $$
begin
  begin
    insert into fin_periods (company_id, name, start_date, end_date)
      values ('00000000-0000-0000-0000-0000000000c1', '2026-07', '2026-10-01', '2026-10-31');
    raise notice 'NAME FAIL: duplicate period name in a company was ACCEPTED';
  exception when unique_violation then
    raise notice 'NAME PASS: duplicate period name rejected';
  end;
end $$;

rollback;

-- APP-LAYER (need a real authenticated user):
--   fin_close_period / fin_reopen_period / fin_lock_period authority gates + transition rules
--   (open->closed->open, closed->locked, locked cannot reopen), and T-2 RLS tenant isolation.
