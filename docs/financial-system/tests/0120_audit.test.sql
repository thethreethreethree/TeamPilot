-- 0120 acceptance tests — immutable audit trail. Staging, 0116-0120 applied. Rollback; NOTICE.
-- Service-role testable (triggers fire regardless of auth; actor is null under service role).

begin;

insert into companies (id, name) values ('00000000-0000-0000-0000-0000000000c1','ACCEPT Co')
  on conflict (id) do nothing;

-- T-27: a change writes exactly one audit row with before/after
do $$ declare aid uuid; n int; v_after jsonb; v_before jsonb; begin
  insert into fin_accounts (id, company_id, code, name, type, normal_balance)
    values ('00000000-0000-0000-0000-00000000ac09','00000000-0000-0000-0000-0000000000c1','9999','Audit Test','asset','debit');
  select count(*) into n from fin_audit_log
    where table_name='fin_accounts' and record_id='00000000-0000-0000-0000-00000000ac09' and action='INSERT';
  if n = 1 then raise notice 'T-27 PASS: INSERT wrote one audit row'; else raise notice 'T-27 FAIL: % insert audit rows', n; end if;
  select after_value into v_after from fin_audit_log
    where record_id='00000000-0000-0000-0000-00000000ac09' and action='INSERT';
  if v_after->>'code' = '9999' then raise notice 'T-27 PASS: after_value captured the row'; else raise notice 'T-27 FAIL: after_value=%', v_after; end if;

  update fin_accounts set name='Audit Test 2' where id='00000000-0000-0000-0000-00000000ac09';
  select before_value, after_value into v_before, v_after from fin_audit_log
    where record_id='00000000-0000-0000-0000-00000000ac09' and action='UPDATE';
  if v_before->>'name'='Audit Test' and v_after->>'name'='Audit Test 2'
    then raise notice 'T-27 PASS: UPDATE captured before AND after (prior value present)';
    else raise notice 'T-27 FAIL: before=% after=%', v_before, v_after; end if;

  select id into aid from fin_audit_log where record_id='00000000-0000-0000-0000-00000000ac09' limit 1;

  -- T-26: the audit log itself is append-only
  begin
    update fin_audit_log set action='TAMPERED' where id=aid;
    raise notice 'T-26 FAIL: audit row was UPDATED';
  exception when others then raise notice 'T-26 PASS: audit row update rejected (%).', sqlerrm; end;
  begin
    delete from fin_audit_log where id=aid;
    raise notice 'T-26 FAIL: audit row was DELETED';
  exception when others then raise notice 'T-26 PASS: audit row delete rejected (%).', sqlerrm; end;
end $$;

rollback;

-- APP-LAYER: T-2 RLS (only configure-level in the company can READ the audit trail); actor
-- correctly captured as the authenticated user under a real JWT.
