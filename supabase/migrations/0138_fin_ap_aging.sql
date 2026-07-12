-- 0138 — Financial System: AP aging (what you owe, by due date) — mirrors AR aging (0133)
--
-- Outstanding = bill total (lines + tax) − payments; days_overdue from due_date. For cash-out
-- planning (which bills are due / overdue). Derived, security_invoker → tenant-safe. Read-only.
--
-- Idempotent (create or replace).

create or replace view fin_ap_aging with (security_invoker = true) as
select
  b.company_id,
  b.id            as bill_id,
  b.bill_number,
  b.vendor_id,
  v.name          as vendor_name,
  b.bill_date,
  b.due_date,
  (select coalesce(sum(l.amount + l.tax_amount),0) from fin_bill_lines l where l.bill_id = b.id)
    - (select coalesce(sum(p.amount),0) from fin_payments p where p.bill_id = b.id) as outstanding,
  case when b.due_date is null then null else (current_date - b.due_date) end as days_overdue
from fin_bills b
join fin_vendors v on v.id = b.vendor_id
where b.status = 'approved';   -- approved + not fully paid

create or replace function fin_ap_aging_summary()
returns jsonb language sql stable security invoker set search_path = public as $$
  with a as (
    select * from fin_ap_aging
    where company_id = auth_company_id() and outstanding > 0
  )
  select jsonb_build_object(
    'current',  (select coalesce(sum(outstanding),0) from a where days_overdue is null or days_overdue <= 0),
    'd1_30',    (select coalesce(sum(outstanding),0) from a where days_overdue between 1 and 30),
    'd31_60',   (select coalesce(sum(outstanding),0) from a where days_overdue between 31 and 60),
    'd61_90',   (select coalesce(sum(outstanding),0) from a where days_overdue between 61 and 90),
    'd90_plus', (select coalesce(sum(outstanding),0) from a where days_overdue > 90),
    'total',    (select coalesce(sum(outstanding),0) from a)
  );
$$;
