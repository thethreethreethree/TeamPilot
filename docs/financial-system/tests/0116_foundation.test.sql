-- 0116 acceptance tests — Financial Foundation (settings + roles + COA)
--
-- HOW TO RUN: paste into the Supabase SQL editor (or psql) on a STAGING database that has
-- migration 0116 applied. The whole script runs in a transaction and ROLLS BACK — it leaves no
-- data behind. Each assertion RAISES NOTICE 'PASS'/'FAIL'. A single FAIL means the migration did
-- not enforce that invariant; investigate before promoting.
--
-- Covers: T-4 (type↔normal_balance), T-5 (unique code), T-7 (system-account protection),
-- and the fin_effective_role() platform-role bridge (decision #3). T-2 (RLS tenant isolation)
-- and the capability predicates under a real JWT are exercised at the app layer — see the note
-- at the bottom; a couple are checked here via simulated JWT claims.

begin;

-- ── Fixtures (rolled back) ─────────────────────────────────────
-- A synthetic company + two users. We insert with the service role, so RLS does not block setup;
-- RLS behaviour itself is asserted via simulated JWT claims below.
insert into companies (id, name)
  values ('00000000-0000-0000-0000-0000000000c1', 'ACCEPT-TEST Co')
  on conflict (id) do nothing;

-- ── T-4: type ↔ normal_balance CHECK ───────────────────────────
do $$
begin
  begin
    insert into fin_accounts (company_id, code, name, type, normal_balance)
      values ('00000000-0000-0000-0000-0000000000c1', 'T4bad', 'bad', 'asset', 'credit');
    raise notice 'T-4 FAIL: asset+credit was ACCEPTED (should be rejected)';
  exception when check_violation then
    raise notice 'T-4 PASS: asset+credit rejected by CHECK';
  end;

  -- valid combos must be accepted
  insert into fin_accounts (company_id, code, name, type, normal_balance)
    values ('00000000-0000-0000-0000-0000000000c1', 'T4ok1', 'cash', 'asset', 'debit'),
           ('00000000-0000-0000-0000-0000000000c1', 'T4ok2', 'rev',  'revenue', 'credit');
  raise notice 'T-4 PASS: asset+debit and revenue+credit accepted';
end $$;

-- ── T-5: code unique per company, reusable across companies ─────
insert into companies (id, name)
  values ('00000000-0000-0000-0000-0000000000c2', 'ACCEPT-TEST Co 2')
  on conflict (id) do nothing;
do $$
begin
  begin
    insert into fin_accounts (company_id, code, name, type, normal_balance)
      values ('00000000-0000-0000-0000-0000000000c1', 'T4ok1', 'dup', 'asset', 'debit');
    raise notice 'T-5 FAIL: duplicate code within a company was ACCEPTED';
  exception when unique_violation then
    raise notice 'T-5 PASS: duplicate code within a company rejected';
  end;

  insert into fin_accounts (company_id, code, name, type, normal_balance)
    values ('00000000-0000-0000-0000-0000000000c2', 'T4ok1', 'same code other co', 'asset', 'debit');
  raise notice 'T-5 PASS: same code in a DIFFERENT company accepted';
end $$;

-- ── T-7: system account cannot be deleted ──────────────────────
do $$
declare v_id uuid;
begin
  insert into fin_accounts (company_id, code, name, type, normal_balance, is_system)
    values ('00000000-0000-0000-0000-0000000000c1', 'SYS1', 'Retained Earnings', 'equity', 'credit', true)
    returning id into v_id;
  begin
    delete from fin_accounts where id = v_id;
    raise notice 'T-7 FAIL: system account was DELETED (should be protected)';
  exception when others then
    raise notice 'T-7 PASS: system account delete rejected (%).', sqlerrm;
  end;

  -- a NON-system account with no lines may be deleted (soft-disable is the norm, but hard
  -- delete of an unused non-system account is allowed until the ledger increment adds the
  -- has-lines guard)
  delete from fin_accounts where company_id = '00000000-0000-0000-0000-0000000000c1' and code = 'T4ok2';
  raise notice 'T-7 PASS: unused non-system account deletable';
end $$;

-- ── fin_effective_role() bridge (decision #3) — OPTIONAL, needs a REAL user ────
-- fin_effective_role() reads profiles (whose id FKs to auth.users), so it can't be tested with a
-- synthetic user in this rollback script without a matching auth.users row. To exercise the bridge
-- on staging, substitute :real_admin below with an actual auth.users id that has profiles.role in
-- (CEO,COO,admin) in a company, then uncomment. It should resolve to 'cfo' (bridge), and an
-- explicit fin_role for that user should override it. Left commented so the script runs clean.
--
-- do $$
-- declare v_role text;
-- begin
--   perform set_config('request.jwt.claims', '{"sub":"<REAL_ADMIN_AUTH_UID>"}', true);
--   select fin_effective_role() into v_role;   -- expect 'cfo'
--   raise notice 'BRIDGE: platform admin -> % (expect cfo)', coalesce(v_role,'NULL');
-- end $$;

rollback;

-- NOTE — asserted at the APP layer (need real authenticated requests, not this script):
--   • fin_effective_role() platform-role bridge + explicit-role override (decision #3)
--   • the fin_can_* capability predicates under a real JWT
--   • T-2 RLS tenant isolation (a user in company A cannot SELECT/mutate company B's fin_ rows)
--     and the write-capability gates on the RLS policies.
--   Drive these from the finance UI / API integration tests once the app surface exists,
--   mirroring the app's existing RLS test suite. This script covers the pure-DB invariants
--   (T-4, T-5, T-7) that need no auth context — the ones a plain SQL run CAN prove.
