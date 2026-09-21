-- A12 RE-RUNNABILITY GUARDS ADDED 2026-09-21. The statements below this line are the original
-- migration; the only change is that object creations are now guarded (drop-if-exists before
-- create policy/trigger, existence checks around create type, if-not-exists on indexes,
-- drop-before-create on views). NOTHING about the resulting schema changed — verified by
-- applying all 254 migrations twice against Postgres 16: 0 failures on a fresh database.
--
-- WHY AN APPLIED MIGRATION WAS EDITED. A12 (0021 and 0022 both failed live on "already
-- exists") requires migrations to be safe-to-re-run BY CONSTRUCTION. 18 of these were not, and
-- a later migration cannot fix an earlier one — on any replay 0001 still runs first. Tested:
-- a repair migration leaves 0001 failing exactly as before. Editing in place is the only thing
-- that reaches zero. Supabase never re-runs an applied migration, so production is untouched.
-- Founder decision, 2026-09-21. Record: docs/tbc/2026-09-21-migration-idempotency/.

-- 0135 — Financial System: bill/invoice summary views (totals + settled, for the list UIs)
--
-- The AP/AR list screens couldn't show amounts (you had to open a doc to see its total). These
-- views compute total (lines + tax) and settled (payments/receipts) in SQL — no JS money math.
-- security_invoker → tenant-safe (inherits fin_bills/fin_invoices RLS).
--
-- Idempotent (create or replace view). Read-only; no new tables.

-- CASCADE, and it matters who reads this. Re-running the WHOLE history is safe: the
-- dependents are rebuilt by their own migrations, which run after this one. Running
-- THIS FILE ALONE by hand will drop views created in 0136, 0146, 0174, 0175, 0185 and NOT
-- bring them back — re-run those too. The drop is required because a later migration
-- widens this view, and `create or replace` cannot remove a column.
drop view if exists fin_bill_summary cascade;
create view fin_bill_summary with (security_invoker = true) as
select
  b.id, b.company_id, b.vendor_id, b.bill_number, b.bill_date, b.due_date, b.currency, b.status,
  (select coalesce(sum(l.amount + l.tax_amount), 0) from fin_bill_lines l where l.bill_id = b.id) as total,
  (select coalesce(sum(p.amount), 0) from fin_payments p where p.bill_id = b.id) as paid
from fin_bills b;

-- CASCADE, and it matters who reads this. Re-running the WHOLE history is safe: the
-- dependents are rebuilt by their own migrations, which run after this one. Running
-- THIS FILE ALONE by hand will drop views created in 0136, 0143, 0175, 0185 and NOT
-- bring them back — re-run those too. The drop is required because a later migration
-- widens this view, and `create or replace` cannot remove a column.
drop view if exists fin_invoice_summary cascade;
create view fin_invoice_summary with (security_invoker = true) as
select
  i.id, i.company_id, i.customer_id, i.invoice_number, i.invoice_date, i.due_date, i.currency, i.status,
  (select coalesce(sum(l.amount + l.tax_amount), 0) from fin_invoice_lines l where l.invoice_id = i.id) as total,
  (select coalesce(sum(r.amount), 0) from fin_receipts r where r.invoice_id = i.id) as received
from fin_invoices i;
