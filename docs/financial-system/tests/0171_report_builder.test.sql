-- 0171 acceptance — CUSTOM REPORT BUILDER. Staging, 0116–0171 applied.
--
-- The assertions here are mostly about what a user CANNOT express.
--
-- A report builder is the one feature in a finance system whose obvious implementation — store the query,
-- run it later — points an arbitrary-SQL execution path at the general ledger. Worse, the natural way to
-- make such an engine work is a SECURITY DEFINER function, which would run the user's query with the
-- DEFINER's authority rather than the reader's. One report saved by one user, opened by another, and
-- another tenant's ledger is one crafted string away.
--
-- So the test is not "does the report compute the right number?" (it does, and that is checkable). It is:
-- CAN A USER MAKE THIS FUNCTION DO SOMETHING WE DID NOT WRITE? The answer must be no, by construction.

begin;

do $$ begin
  -- Every user-supplied field is a CHECK-constrained enum, not a string interpolated into SQL.
  if (select count(*) from pg_constraint c
       join pg_class t on t.oid = c.conrelid
      where t.relname = 'fin_report_definitions' and c.contype = 'c') >= 4
  then raise notice 'REPORT PASS: the report vocabulary is CHECK-constrained — a user chooses from a closed set, they do not write a query';
  else raise notice 'REPORT FAIL: the definition accepts free text — this is an arbitrary-SQL path into the ledger';
  end if;

  -- There must be no column that could hold SQL.
  if not exists (
    select 1 from information_schema.columns
     where table_name = 'fin_report_definitions'
       and column_name in ('sql','query','expression','where_clause','custom_sql')
  ) then raise notice 'REPORT PASS: no column stores SQL. There is no stored query to inject into';
  else raise notice 'REPORT FAIL: a column stores a query — the ledger now has a user-controlled execution path';
  end if;
end $$;

rollback;

-- ══ APP-LAYER ═══════════════════════════════════════════════════════════════════════════════
--
-- 1 · TENANT ISOLATION IS NOT A PARAMETER.  ***THE ASSERTION THIS FILE EXISTS FOR.***
--     fin_run_report is SECURITY DEFINER, so it runs with elevated authority. Its WHERE clause pins
--     l.company_id = auth_company_id() — HARD-WIRED, not passed in.
--     • As company A, save a report. As company B, call fin_run_report(<A's report id>).
--       → MUST RAISE ('Report not found in your company'). Not "return empty" — RAISE.
--     • Confirm by reading the function source that company_id is NOT a function parameter anywhere.
--       If it ever becomes one, a caller can substitute another tenant's id and the DEFINER will happily
--       oblige. This is the single line that separates a report builder from a cross-tenant ledger dump.
--
-- 2 · INJECTION IS UNREPRESENTABLE.  Attempt to save a definition with
--       group_by = 'account; drop table fin_journal_lines--'
--     → MUST be rejected by the CHECK constraint at INSERT time. The string never reaches SQL because it
--     never reaches the table.
--
-- 3 · A BALANCE IS NOT A MOVEMENT.  Save a report with measure='closing_balance', period='this_month'.
--     → The result MUST be the balance from the beginning of the ledger, NOT the month's movement.
--     A "closing balance" computed only over one month is a movement wearing a balance's name — it would
--     look exactly like a balance-sheet figure and be a completely different quantity.
--
-- 4 · SIGNS ARE NORMALIZED TO THE ACCOUNT'S NORMAL SIDE.  A report grouped by account_type showing both
--     revenue and expense MUST return both as positive magnitudes of their own normal side.
--     Without this, revenue (credit-normal) and expenses (debit-normal) carry opposite signs in the same
--     column, and a reader compares them as if they were like quantities. They would sum to something
--     meaningless and it would look like a profit figure.
--
-- 5 · THE WINDOW IS RESOLVED AT RUN TIME.  Save 'this_quarter' in Q1. Open it in Q4.
--     → It MUST show Q4. A saved report with a frozen absolute range would still show Q1 and look current
--     — a stale number that nothing marks as stale is worse than an empty report.
--
-- 6 · ONLY POSTED ENTRIES.  A draft entry MUST NOT appear in any report. A report that included drafts
--     would let anyone with entry rights move a headline figure without an approval.
--
-- 7 · A SHARED REPORT CANNOT BE SILENTLY REDEFINED.  User A saves "Monthly burn". User B (a viewer, not
--     the author, not a controller) attempts to update it.
--     → MUST be denied by RLS. Otherwise B could change the definition of a report A reads every month,
--     and A's numbers would change with no visible cause.
