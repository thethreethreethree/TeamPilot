-- 0122 acceptance — Phase-2 subledger foundation. Staging, 0116-0122 applied. Rollback; NOTICE.
-- fin_account_by_code is service-role-testable. fin_post_system_entry is REVOKED from direct client
-- calls (only subledger DEFINER functions invoke it), so it's exercised by the AP/AR/expense
-- increment tests, not here.

begin;

insert into companies (id, name) values ('00000000-0000-0000-0000-0000000000c1','ACCEPT Co')
  on conflict (id) do nothing;
insert into fin_accounts (company_id, code, name, type, normal_balance) values
  ('00000000-0000-0000-0000-0000000000c1','1100','Accounts Receivable','asset','debit'),
  ('00000000-0000-0000-0000-0000000000c1','4000','Revenue','revenue','credit')
  on conflict (company_id, code) do nothing;

do $$ declare a uuid; b uuid; begin
  a := fin_account_by_code('00000000-0000-0000-0000-0000000000c1','1100');
  b := fin_account_by_code('00000000-0000-0000-0000-0000000000c1','9999');
  if a is not null then raise notice 'CODE PASS: fin_account_by_code resolved AR (1100)'; else raise notice 'CODE FAIL: 1100 not resolved'; end if;
  if b is null then raise notice 'CODE PASS: unknown code -> null'; else raise notice 'CODE FAIL: unknown code resolved'; end if;
end $$;

rollback;

-- APP-LAYER (via the subledger increments): fin_post_system_entry posts a balanced source entry,
-- links it in fin_source_postings, enforces >=2 lines + balance + open-period, and is NOT callable
-- directly by a client (execute revoked). SoD is intentionally skipped (Decision 1) because the
-- source document already carried its approval.
