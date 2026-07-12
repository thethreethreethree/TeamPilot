-- 0133 — Financial System: AR aging (30/60/90) — derived, no new state
--
-- Outstanding = invoice total (lines + tax) − receipts applied; days_overdue from due_date. Buckets
-- summed in SQL. security_invoker views + auth_company_id() → tenant-safe. Backs the AR aging report.
--
-- Idempotent (create or replace).

create or replace view fin_ar_aging with (security_invoker = true) as
select
  i.company_id,
  i.id            as invoice_id,
  i.invoice_number,
  i.customer_id,
  c.name          as customer_name,
  i.invoice_date,
  i.due_date,
  (select coalesce(sum(l.amount + l.tax_amount),0) from fin_invoice_lines l where l.invoice_id = i.id)
    - (select coalesce(sum(r.amount),0) from fin_receipts r where r.invoice_id = i.id) as outstanding,
  case when i.due_date is null then null else (current_date - i.due_date) end as days_overdue
from fin_invoices i
join fin_customers c on c.id = i.customer_id
where i.status = 'sent';   -- issued + not fully paid

-- Bucketed summary for the aging report. Only invoices with a positive outstanding balance.
create or replace function fin_ar_aging_summary()
returns jsonb language sql stable security invoker set search_path = public as $$
  with a as (
    select * from fin_ar_aging
    where company_id = auth_company_id() and outstanding > 0
  )
  select jsonb_build_object(
    'current',  (select coalesce(sum(outstanding),0) from a where days_overdue is null or days_overdue <= 0),
    'd1_30',    (select coalesce(sum(outstanding),0) from a where days_overdue between 1 and 30),
    'd31_60',   (select coalesce(sum(outstanding),0) from a where days_overdue between 31 and 60),
    'd61_90',   (select coalesce(sum(outstanding),0) from a where days_overdue between 61 and 90),
    'd90_plus', (select coalesce(sum(outstanding),0) from a where days_overdue > 90),
    'total',    (select coalesce(sum(outstanding),0) from a),
    'invoices', (select coalesce(jsonb_agg(jsonb_build_object(
                   'number', invoice_number, 'customer', customer_name,
                   'outstanding', outstanding, 'days_overdue', days_overdue)
                   order by days_overdue desc nulls last), '[]'::jsonb) from a)
  );
$$;
