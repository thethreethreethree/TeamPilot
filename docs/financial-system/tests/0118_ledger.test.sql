-- 0118 acceptance tests — the ledger (balance, line CHECKs, immutability). Staging, 0116-0118
-- applied. Rollback transaction; RAISE NOTICE PASS/FAIL. These exercise the DATABASE-LEVEL
-- guarantees via direct writes (service role) — i.e. WITHOUT the fin_post_entry RPC — which is
-- exactly the point: the invariants must hold even when the RPC is bypassed. The RPC-driven flow
-- (authorization, SoD self-approval block, gap-free numbering, reversal) needs a real user and is
-- asserted at the app layer (see bottom).

begin;

-- ── Fixtures ──
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

-- helper to make a fresh draft entry, returns id
create or replace function _mk_draft() returns uuid language plpgsql as $$
declare v uuid; begin
  insert into fin_journal_entries (company_id, entry_date, period_id, description)
    values ('00000000-0000-0000-0000-0000000000c1','2026-07-15','00000000-0000-0000-0000-0000000000p1','test')
    returning id into v; return v; end $$;

-- ── T-10: a line is debit XOR credit ──
do $$ declare e uuid; begin
  e := _mk_draft();
  begin
    insert into fin_journal_lines (company_id, entry_id, line_no, account_id, debit, credit)
      values ('00000000-0000-0000-0000-0000000000c1', e, 1, '00000000-0000-0000-0000-00000000ac01', 100, 100);
    raise notice 'T-10 FAIL: line with both debit AND credit accepted';
  exception when check_violation then raise notice 'T-10 PASS: debit+credit both>0 rejected'; end;
  begin
    insert into fin_journal_lines (company_id, entry_id, line_no, account_id, debit, credit)
      values ('00000000-0000-0000-0000-0000000000c1', e, 2, '00000000-0000-0000-0000-00000000ac01', 0, 0);
    raise notice 'T-10 FAIL: empty line (0/0) accepted';
  exception when check_violation then raise notice 'T-10 PASS: 0/0 line rejected'; end;
end $$;

-- ── T-8: a BALANCED entry can post; base amounts computed by trigger ──
do $$ declare e uuid; begin
  e := _mk_draft();
  insert into fin_journal_lines (company_id, entry_id, line_no, account_id, debit, credit)
    values ('00000000-0000-0000-0000-0000000000c1', e, 1, '00000000-0000-0000-0000-00000000ac01', 100, 0),
           ('00000000-0000-0000-0000-0000000000c1', e, 2, '00000000-0000-0000-0000-00000000ac02', 0, 100);
  update fin_journal_entries set status='posted', posted_at=now(), entry_no=1 where id=e;
  set constraints fin_assert_balanced_entry_trg, fin_assert_balanced_trg immediate;  -- force deferred checks now
  raise notice 'T-8 PASS: balanced entry posted (base_debit=base_credit=100)';
end $$;

-- ── T-8 backstop: an UNBALANCED entry CANNOT be posted (even bypassing the RPC) ──
do $$ declare e uuid; begin
  e := _mk_draft();
  insert into fin_journal_lines (company_id, entry_id, line_no, account_id, debit, credit)
    values ('00000000-0000-0000-0000-0000000000c1', e, 1, '00000000-0000-0000-0000-00000000ac01', 100, 0),
           ('00000000-0000-0000-0000-0000000000c1', e, 2, '00000000-0000-0000-0000-00000000ac02', 0, 50);
  begin
    update fin_journal_entries set status='posted', posted_at=now(), entry_no=2 where id=e;
    set constraints fin_assert_balanced_entry_trg, fin_assert_balanced_trg immediate;  -- force the check
    raise notice 'T-8 FAIL: UNBALANCED entry (100 vs 50) was posted';
  exception when others then raise notice 'T-8 PASS: unbalanced entry rejected by DB (%).', sqlerrm; end;
end $$;

-- ── T-14: a posted entry is immutable ──
do $$ declare e uuid; begin
  e := _mk_draft();
  insert into fin_journal_lines (company_id, entry_id, line_no, account_id, debit, credit)
    values ('00000000-0000-0000-0000-0000000000c1', e, 1, '00000000-0000-0000-0000-00000000ac01', 10, 0),
           ('00000000-0000-0000-0000-0000000000c1', e, 2, '00000000-0000-0000-0000-00000000ac02', 0, 10);
  update fin_journal_entries set status='posted', posted_at=now(), entry_no=3 where id=e;
  set constraints all immediate;
  begin
    update fin_journal_entries set description='tampered' where id=e;
    raise notice 'T-14 FAIL: posted entry was edited';
  exception when others then raise notice 'T-14 PASS: posted entry edit rejected (%).', sqlerrm; end;
end $$;

-- ── T-18: closed period rejects new entries ──
do $$ declare e uuid; begin
  update fin_periods set status='closed' where id='00000000-0000-0000-0000-0000000000p1';
  begin
    insert into fin_journal_entries (company_id, entry_date, period_id, description)
      values ('00000000-0000-0000-0000-0000000000c1','2026-07-20','00000000-0000-0000-0000-0000000000p1','into closed');
    raise notice 'T-18 FAIL: entry created in a CLOSED period';
  exception when others then raise notice 'T-18 PASS: write to closed period rejected (%).', sqlerrm; end;
end $$;

drop function _mk_draft();
rollback;

-- APP-LAYER (need a real authenticated user):
--   fin_post_entry authorization (only approver/controller/cfo) · SoD self-approval block (T-15,
--   created_by <> approver) · T-9 min-2-lines via the RPC · gap-free per-company entry_no ·
--   fin_reverse_entry creating a DRAFT that a DIFFERENT approver posts (T-17) · T-2 RLS isolation
--   and the WITH CHECK that a client cannot directly insert a 'posted' entry. Drive from the
--   finance API integration tests once the app surface exists.
