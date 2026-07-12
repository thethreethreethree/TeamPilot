-- 0137 — Financial System: expense-report summary view (total, for the list UI)
--
-- Matches 0135 for bills/invoices: the expense-reports list couldn't show amounts. total = items +
-- tax, summed in SQL. security_invoker → inherits fin_expense_reports RLS (employee sees own,
-- finance sees all). Read-only.

create or replace view fin_expense_report_summary with (security_invoker = true) as
select
  r.id, r.company_id, r.employee_user_id, r.title, r.status,
  r.submitted_at, r.approved_at, r.reimbursed_at,
  (select coalesce(sum(it.amount + it.tax_amount), 0) from fin_expense_items it where it.report_id = r.id) as total
from fin_expense_reports r;
