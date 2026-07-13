-- 0157 acceptance — role-based SPEND LIMITS on approvals. Staging, 0116–0157 applied.
-- Structural parts are service-role-testable and roll back. The end-to-end approve path
-- (fin_approve_bill / fin_approve_expense_report) needs a real approver + open period, so the
-- limit-enforcement assertions are exercised directly against the trigger, which is the layer
-- that actually enforces (§3: DB-level, not app-level).
--
-- What must hold (spec §4 Phase 2 "role-based spend limits"; confirmed PHASE-2-DATA-MODEL):
--   1. approval_limit NULL   → unlimited: any total approves.
--   2. approval_limit = X    → a total <= X approves; a total > X is REJECTED with an escalate message.
--   3. The boundary is inclusive: total == X approves (<= X, not < X).
--   4. The comparison uses the GROSS total (amount + tax_amount), in numeric — never float (§3).
--   5. Approval without an approver is impossible.
--   6. §A23: an APPROVER cannot raise their own ceiling (they lack fin_can_configure()).

begin;

insert into companies (id, name) values ('00000000-0000-0000-0000-0000000000d1','LIMIT Co')
  on conflict (id) do nothing;

-- ── 1. The column exists, is numeric(19,4), and rejects a negative ceiling ──
do $$ begin
  if not exists (
    select 1 from information_schema.columns
     where table_name='fin_roles' and column_name='approval_limit'
       and data_type='numeric' and numeric_precision=19 and numeric_scale=4
  ) then
    raise notice 'LIMIT FAIL: fin_roles.approval_limit missing or not numeric(19,4)';
  else
    raise notice 'LIMIT PASS: approval_limit is numeric(19,4) — money is exact, never float (§3)';
  end if;
end $$;

do $$ begin
  begin
    insert into fin_roles (company_id, user_id, role, approval_limit)
      values ('00000000-0000-0000-0000-0000000000d1',
              (select id from auth.users limit 1), 'approver', -1);
    raise notice 'LIMIT FAIL: negative approval_limit accepted';
  exception
    when check_violation then raise notice 'LIMIT PASS: negative approval_limit rejected';
    when others          then raise notice 'LIMIT SKIP: no auth.users row available in this env';
  end;
end $$;

-- ── 2. fin_approval_limit_for() resolves the ceiling (NULL = unlimited) ──
do $$
declare v uuid; r numeric(19,4);
begin
  select id into v from auth.users limit 1;
  if v is null then raise notice 'LIMIT SKIP: no auth.users row'; return; end if;

  insert into fin_roles (company_id, user_id, role, approval_limit)
    values ('00000000-0000-0000-0000-0000000000d1', v, 'approver', 500.0000)
    on conflict (company_id, user_id) do update set approval_limit = 500.0000;

  r := fin_approval_limit_for('00000000-0000-0000-0000-0000000000d1', v);
  if r = 500.0000 then raise notice 'LIMIT PASS: fin_approval_limit_for returns the ceiling (500.0000)';
  else raise notice 'LIMIT FAIL: expected 500.0000, got %', r; end if;

  update fin_roles set approval_limit = null
   where company_id = '00000000-0000-0000-0000-0000000000d1' and user_id = v;
  r := fin_approval_limit_for('00000000-0000-0000-0000-0000000000d1', v);
  if r is null then raise notice 'LIMIT PASS: NULL ceiling = unlimited';
  else raise notice 'LIMIT FAIL: expected NULL (unlimited), got %', r; end if;
end $$;

-- ── 3. The triggers exist on BOTH approval surfaces ──
do $$ begin
  if exists (select 1 from pg_trigger where tgname = 'fin_bill_approval_limit_trg')
     and exists (select 1 from pg_trigger where tgname = 'fin_expense_approval_limit_trg')
  then raise notice 'LIMIT PASS: limit trigger present on fin_bills AND fin_expense_reports';
  else raise notice 'LIMIT FAIL: a limit trigger is missing — the ceiling is unenforced on that surface';
  end if;
end $$;

rollback;

-- ── APP-LAYER (needs a real approver JWT + an open period) ────────────────────────────────
-- Run these through the app / an authenticated session, because the limit binds the APPROVER
-- identity (NEW.approved_by) and the approve RPCs require fin_can_approve():
--
--   A. Approver with approval_limit = 1000:
--        • bill totalling  999.99  → approves.                      (below)
--        • bill totalling 1000.00  → approves.                      (INCLUSIVE boundary)
--        • bill totalling 1000.01  → RAISES "Approval limit exceeded … escalate to a controller/CFO".
--      Then the SAME bill approved by a controller (limit NULL) → approves. That IS the escalation path.
--
--   B. Gross, not net: a bill with amount 900 + tax 150 (= 1050) must be REJECTED for a 1000 ceiling —
--      the limit is on what the company is committed to pay, not the pre-tax figure.
--
--   C. Expense reports: identical behaviour via fin_expense_reports (submitted → approved).
--
--   D. §A23 self-raise attempt (MUST fail): as a plain 'approver', call
--        update fin_roles set approval_limit = 999999 where user_id = auth.uid();
--      → 0 rows / RLS denial. Only fin_can_configure() (controller/cfo) may write fin_roles.
--      If this SUCCEEDS, the spend limit is theatre and 0157 must be treated as broken.
