-- 0146 — Financial System: duplicate-payment detection (Phase-4 "waste & efficiency" quick win).
--
-- Pure derivation over existing bills — no new data model, no decision needed, so it ships ahead of
-- the rest of Phase 4. Flags pairs of bills for the SAME vendor with the SAME total whose dates are
-- within 7 days: the classic double-entry / double-pay mistake. A candidate, not a verdict — the
-- surface asks the human to confirm (guide-don't-overtake). security_invoker → tenant-safe.
--
-- Idempotent (create or replace).

create or replace view fin_duplicate_bill_candidates with (security_invoker = true) as
select
  b1.company_id,
  b1.id            as bill_id,
  b1.vendor_id,
  v.name           as vendor_name,
  b1.bill_number,
  b1.bill_date,
  b1.status,
  s1.total,
  b2.id            as other_bill_id,
  b2.bill_number   as other_bill_number,
  b2.bill_date     as other_bill_date,
  b2.status        as other_status,
  abs(b1.bill_date - b2.bill_date) as days_apart
from fin_bills b1
join fin_bill_summary s1 on s1.id = b1.id
join fin_vendors v on v.id = b1.vendor_id
join fin_bills b2
  on b2.company_id = b1.company_id
 and b2.vendor_id  = b1.vendor_id
 and b2.id <> b1.id
join fin_bill_summary s2 on s2.id = b2.id
where s1.total = s2.total
  and s1.total > 0
  and abs(b1.bill_date - b2.bill_date) <= 7
  and b1.id < b2.id;   -- list each pair once
