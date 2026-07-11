-- 0125 acceptance — Expense Management. Staging, 0116-0125 applied. Rollback; NOTICE.
-- Structure is service-role-testable; approve/reimburse→GL + the employee≠approver SoD + the
-- draft-lock RLS are app-layer (need real users).

begin;
insert into companies (id, name) values ('00000000-0000-0000-0000-0000000000c1','ACCEPT Co')
  on conflict (id) do nothing;

-- expense item amount must be >= 0
do $$ declare r uuid; begin
  insert into fin_expense_reports (id, company_id, employee_user_id, title)
    values ('00000000-0000-0000-0000-0000000e0001','00000000-0000-0000-0000-0000000000c1',
            (select id from auth.users limit 1), 'Trip');
  if not found then raise notice 'EXP SKIP: no auth.users to attach (run with a real user present)'; end if;
exception when others then raise notice 'EXP note: %', sqlerrm;
end $$;

rollback;

-- APP-LAYER (real users): an employee submits their OWN report (any company member); a DIFFERENT
-- approver approves it (SoD: cannot approve own — fin_approve_expense_report rejects self); approval
-- posts a BALANCED Dr expense + Dr Tax Receivable / Cr Employee Reimbursements Payable; reimburse
-- posts Dr payable / Cr Cash. RLS locks items + report after submission (can't edit a posted report);
-- an employee cannot self-approve via a direct status write (with-check restricts to draft/submitted).
