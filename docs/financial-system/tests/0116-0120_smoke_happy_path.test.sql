-- Phase-1 HAPPY-PATH smoke test — proves the ledger actually WORKS (not just that bad input is
-- rejected). Staging, 0116-0120 applied. Rollback transaction; RAISE NOTICE PASS/FAIL.
--
-- Posts via a direct status flip (service role) rather than fin_post_entry, because the RPC needs
-- a real authenticated approver — but the DB-level guarantees (balance, base computation, derived
-- balances, trial balance) are exactly what we prove here, and they hold on ANY posting path.

begin;

-- 1) Init a company's books (direct, mirroring what fin_init_company does)
insert into companies (id, name) values ('00000000-0000-0000-0000-0000000000c1','SMOKE Co')
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

-- 2) A balanced entry: Cash 1000 debit / Revenue 1000 credit → 3) post it
do $$ declare e uuid; d numeric; c numeric; bal numeric; begin
  insert into fin_journal_entries (id, company_id, entry_date, period_id, description)
    values ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000c1','2026-07-15','00000000-0000-0000-0000-0000000000p1','Sale');
  insert into fin_journal_lines (company_id, entry_id, line_no, account_id, debit, credit) values
    ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e1',1,'00000000-0000-0000-0000-00000000ac01',1000,0),
    ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e1',2,'00000000-0000-0000-0000-00000000ac02',0,1000);
  update fin_journal_entries set status='posted', posted_at=now(), entry_no=1
    where id='00000000-0000-0000-0000-0000000000e1';
  set constraints all immediate;  -- force the deferred balance check now → must NOT raise
  raise notice 'SMOKE PASS: balanced entry posted cleanly';

  -- 4) the entry balances (T-8)
  select sum(base_debit), sum(base_credit) into d, c
    from fin_journal_lines where entry_id='00000000-0000-0000-0000-0000000000e1';
  if d = 1000 and c = 1000 then raise notice 'SMOKE PASS: entry balances (1000=1000 base)';
    else raise notice 'SMOKE FAIL: entry d=% c=%', d, c; end if;

  -- 5) TRIAL BALANCE nets to zero across the company (T-12): sum posted debits = sum posted credits
  select coalesce(sum(l.base_debit),0), coalesce(sum(l.base_credit),0) into d, c
    from fin_journal_lines l join fin_journal_entries je on je.id=l.entry_id
    where je.company_id='00000000-0000-0000-0000-0000000000c1' and je.status='posted';
  if d = c then raise notice 'SMOKE PASS: trial balance nets to zero (debits % = credits %)', d, c;
    else raise notice 'SMOKE FAIL: trial balance debits % <> credits %', d, c; end if;

  -- 6) DERIVED balance drills to source (T-11): Cash balance = sum(debit)-sum(credit) over posted lines
  select coalesce(sum(l.base_debit),0) - coalesce(sum(l.base_credit),0) into bal
    from fin_journal_lines l join fin_journal_entries je on je.id=l.entry_id
    where je.status='posted' and l.account_id='00000000-0000-0000-0000-00000000ac01';
  if bal = 1000 then raise notice 'SMOKE PASS: Cash derived balance = 1000 (drills to the source line)';
    else raise notice 'SMOKE FAIL: Cash balance = %', bal; end if;
end $$;

rollback;

-- If every line above says PASS, the Phase-1 ledger posts a balanced entry, keeps the books
-- balanced, and derives account + trial balances correctly from source lines. Combined with the
-- five per-migration rejection tests (0116-0120), that covers the Phase-1 DB-level correctness
-- contract. The app-layer contract (RLS isolation, RPC authority, SoD under a real user) remains.
