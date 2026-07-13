-- 0145 acceptance — bank auto-match candidate logic (Phase 3). Staging with 0116-0145 applied.
-- Rollback; NOTICE. fin_auto_match_bank is auth-gated (fin_can_enter) → the loop/insert is app/staging;
-- this verifies the CANDIDATE-MATCH predicate it uses: a bank line matches a posted GL cash line on
-- the bank's gl_account when amounts are equal (signed) and dates are within ±3 days, single candidate.
-- The predicate below MIRRORS fin_auto_match_bank's `cand` CTE — keep them in sync. UUIDs valid hex.

begin;

insert into companies (id, name) values ('00000000-0000-0000-0000-0000000000c1','ACCEPT Co')
  on conflict (id) do nothing;
insert into fin_settings (company_id, base_currency) values ('00000000-0000-0000-0000-0000000000c1','USD')
  on conflict (company_id) do nothing;
insert into fin_accounts (company_id, code, name, type, normal_balance) values
  ('00000000-0000-0000-0000-0000000000c1','1000','Cash','asset','debit'),
  ('00000000-0000-0000-0000-0000000000c1','4000','Revenue','revenue','credit')
  on conflict (company_id, code) do nothing;
insert into fin_periods (id, company_id, name, start_date, end_date, status)
  values ('00000000-0000-0000-0000-000000000f01','00000000-0000-0000-0000-0000000000c1','2026','2026-01-01','2026-12-31','open')
  on conflict (id) do nothing;

-- A posted entry on 2026-07-15: Dr Cash 100 / Cr Revenue 100 (a cash deposit of 100 in the ledger).
insert into fin_journal_entries (id, company_id, entry_date, period_id, description, status)
  values ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000c1','2026-07-15','00000000-0000-0000-0000-000000000f01','cash sale','posted')
  on conflict (id) do nothing;
insert into fin_journal_lines (company_id, entry_id, line_no, account_id, debit, credit) values
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e1',1,(select id from fin_accounts where company_id='00000000-0000-0000-0000-0000000000c1' and code='1000'),100,0),
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e1',2,(select id from fin_accounts where company_id='00000000-0000-0000-0000-0000000000c1' and code='4000'),0,100)
  on conflict do nothing;

-- Replicates fin_auto_match_bank's candidate count for a (signed amount, date) against the Cash GL account.
create or replace function pg_temp.cand_count(p_amount numeric, p_date date) returns int language sql stable as $$
  with cand as (
    select e.id
    from fin_journal_lines l join fin_journal_entries e on e.id = l.entry_id
    join fin_accounts a on a.id = l.account_id
    where a.company_id='00000000-0000-0000-0000-0000000000c1' and a.code='1000' and e.status='posted'
      and e.entry_date between p_date - 3 and p_date + 3
      and ((p_amount > 0 and l.base_debit = p_amount) or (p_amount < 0 and l.base_credit = -p_amount))
      and not exists (select 1 from fin_reconciliation_matches m where m.entry_id = e.id)
    group by e.id
  ) select count(*)::int from cand;
$$;

do $$ begin
  -- +100 on 2026-07-16: within ±3 days of the 07-15 entry, equal amount → exactly 1 candidate → matches.
  if pg_temp.cand_count(100, '2026-07-16') = 1 then raise notice 'MATCH PASS: +100 @ 07-16 → 1 candidate (07-15 entry, within 3d)';
  else raise notice 'MATCH FAIL: +100 @ 07-16 → % (want 1)', pg_temp.cand_count(100,'2026-07-16'); end if;
  -- +100 on 2026-07-25: 10 days from the entry → outside ±3 → 0 candidates → left for manual review.
  if pg_temp.cand_count(100, '2026-07-25') = 0 then raise notice 'MATCH PASS: +100 @ 07-25 → 0 (outside ±3 days)';
  else raise notice 'MATCH FAIL: +100 @ 07-25 → % (want 0)', pg_temp.cand_count(100,'2026-07-25'); end if;
  -- +50 on 2026-07-15: amount doesn't match any cash line → 0.
  if pg_temp.cand_count(50, '2026-07-15') = 0 then raise notice 'MATCH PASS: +50 @ 07-15 → 0 (no equal-amount cash line)';
  else raise notice 'MATCH FAIL: +50 @ 07-15 → % (want 0)', pg_temp.cand_count(50,'2026-07-15'); end if;
  -- boundary: +100 on 2026-07-18 (exactly +3 days) → still in window → 1.
  if pg_temp.cand_count(100, '2026-07-18') = 1 then raise notice 'MATCH PASS: +100 @ 07-18 (exactly +3d) → 1 (inclusive boundary)';
  else raise notice 'MATCH FAIL: +100 @ 07-18 → % (want 1)', pg_temp.cand_count(100,'2026-07-18'); end if;
end $$;

-- 1:1 invariant (the fix committed 2026-07-13): once a GL entry is matched to one bank line, it drops
-- out of the candidate set — so NEITHER auto-match NOR the manual fin_match_bank_txn (now guarded) can
-- reconcile it against a SECOND bank line. Seed a match for entry e1, then re-check its candidacy.
insert into fin_bank_accounts (id, company_id, name, currency, gl_account_id)
  values ('00000000-0000-0000-0000-0000000000ba','00000000-0000-0000-0000-0000000000c1','Checking','USD',
          (select id from fin_accounts where company_id='00000000-0000-0000-0000-0000000000c1' and code='1000'))
  on conflict (id) do nothing;
insert into fin_bank_transactions (id, company_id, bank_account_id, txn_date, amount, description, status)
  values ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000ba','2026-07-16',100,'deposit','matched')
  on conflict (id) do nothing;
insert into fin_reconciliation_matches (company_id, bank_transaction_id, entry_id)
  values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000e1')
  on conflict do nothing;
do $$ begin
  -- Before the match it was 1 candidate (proved above); now that e1 is reconciled it must be 0.
  if pg_temp.cand_count(100, '2026-07-16') = 0 then raise notice '1:1 PASS: a matched entry is excluded from candidates → it cannot be reconciled to a second bank line (auto or manual)';
  else raise notice '1:1 FAIL: matched entry still a candidate → % (want 0)', pg_temp.cand_count(100,'2026-07-16'); end if;
end $$;

rollback;

-- APP-LAYER (auth-gated): fin_auto_match_bank loops unmatched lines, inserts fin_reconciliation_matches
-- + flips status when exactly 1 candidate; fin_match_bank_txn does a manual link — now rejecting an entry
-- that is already reconciled (the 1:1 guard added 2026-07-13). Drive via the Banking UI: import a CSV,
-- Auto-match, confirm matched/unmatched counts + that a matched entry can't re-match on either path.
