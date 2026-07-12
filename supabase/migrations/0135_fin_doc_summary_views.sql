-- 0135 — Financial System: bill/invoice summary views (totals + settled, for the list UIs)
--
-- The AP/AR list screens couldn't show amounts (you had to open a doc to see its total). These
-- views compute total (lines + tax) and settled (payments/receipts) in SQL — no JS money math.
-- security_invoker → tenant-safe (inherits fin_bills/fin_invoices RLS).
--
-- Idempotent (create or replace view). Read-only; no new tables.

create or replace view fin_bill_summary with (security_invoker = true) as
select
  b.id, b.company_id, b.vendor_id, b.bill_number, b.bill_date, b.due_date, b.currency, b.status,
  (select coalesce(sum(l.amount + l.tax_amount), 0) from fin_bill_lines l where l.bill_id = b.id) as total,
  (select coalesce(sum(p.amount), 0) from fin_payments p where p.bill_id = b.id) as paid
from fin_bills b;

create or replace view fin_invoice_summary with (security_invoker = true) as
select
  i.id, i.company_id, i.customer_id, i.invoice_number, i.invoice_date, i.due_date, i.currency, i.status,
  (select coalesce(sum(l.amount + l.tax_amount), 0) from fin_invoice_lines l where l.invoice_id = i.id) as total,
  (select coalesce(sum(r.amount), 0) from fin_receipts r where r.invoice_id = i.id) as received
from fin_invoices i;
