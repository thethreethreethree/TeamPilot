-- 0174 — PHASE 4: SPEND ANOMALY DETECTION.
--
-- ── THE DESIGN DECISION, AND IT IS THE WHOLE FEATURE ─────────────────────────────────────────
--
-- The obvious build is a statistical outlier detector: model each vendor's normal spend, flag anything
-- more than N standard deviations out. It demos beautifully. It is also, in practice, a machine for
-- producing noise — and noise here is not a nuisance, it is the failure mode.
--
-- An anomaly list that cries wolf is worse than NO anomaly list. A controller who opens it and finds
-- fourteen "anomalies" that are all just a bigger-than-usual electricity bill learns, in about two weeks,
-- to close the tab without reading it. And then the ONE entry that was a real duplicate payment, or a bill
-- split to dodge an approval limit, scrolls past unread — with a system that reported it, which is worse
-- than a system that never claimed to look. (§A25: a false match is worse than a miss.)
--
-- So this migration detects NOTHING statistical. Every rule below is a DEFINITE, EXPLAINABLE FACT about a
-- document that exists. Each one can be stated in a sentence a controller would act on immediately, and
-- each one is either true or it isn't:
--
--   1. THRESHOLD GAMING — a bill sitting just under someone's approval limit. This is the single most
--      valuable rule here, because it is the signature of DELIBERATE circumvention, not error. Nobody
--      accidentally invoices £4,999 when the approval limit is £5,000. It is invisible to every other
--      control in this system precisely BECAUSE it stays within the rules: the approval is valid, the
--      limit was respected, the ledger balances, and nothing anywhere disagrees.
--
--   2. SPLIT BILLS — the same vendor, the same day, multiple bills that individually clear an approval
--      limit and together do not. The other half of threshold gaming.
--
--   3. FIRST PAYMENT TO A BRAND-NEW VENDOR, at material size. The classic invoice-fraud shape: a vendor
--      created and paid within days, by the same person.
--
--   4. SAME PERSON CREATED AND APPROVED (SoD bypass that slipped through a gap). This should be
--      impossible — the SoD checks prevent it. The rule exists to detect it if a future migration ever
--      weakens that guard. A control that verifies another control.
--
-- WHAT IT DELIBERATELY DOES NOT FLAG: a big bill. Big bills are usually just big.
--
-- Every row carries its OWN EXPLANATION — the reason is a column, not a severity score. A score tells a
-- controller how worried to be; a reason tells them what to DO.
--
-- Idempotent (§A12). NOT VERIFIED against a live database. BUILT, not TESTED.

-- ─── 1 + 2: threshold gaming ──────────────────────────────────────────
-- Compares each bill against the approval limits that actually exist in this company (0157). A company
-- with no limits set has no threshold to game, and correctly produces no findings — rather than inventing
-- a limit so the rule has something to say.
create or replace view fin_anomaly_threshold_gaming with (security_invoker = true) as
  with limits as (
    select company_id, approval_limit
      from fin_roles
     where approval_limit is not null
     group by company_id, approval_limit
  )
  select b.company_id,
         'threshold_gaming'::text as kind,
         b.id                     as bill_id,
         b.vendor_id,
         v.name                   as vendor_name,
         b.bill_date,
         b.total,
         l.approval_limit,
         -- The explanation IS the output. Not a score.
         format(
           'This bill is %s — just under the %s approval limit. Bills that land within 5%% of a limit are '
           || 'the signature of deliberate circumvention, not coincidence: the approval is valid, the limit '
           || 'was respected, and no other control in this system would ever object.',
           to_char(b.total, 'FM999,999,990.00'),
           to_char(l.approval_limit, 'FM999,999,990.00')
         ) as reason
    -- fin_bills carries no `total` column — a bill's total is the sum of its lines, exposed by
    -- fin_bill_summary (0135). Checked against the schema, not assumed.
    from fin_bill_summary b
    join limits l  on l.company_id = b.company_id
    left join fin_vendors v on v.id = b.vendor_id
   where b.status in ('approved','paid')
     and b.total <= l.approval_limit
     and b.total >= l.approval_limit * 0.95;   -- within 5% under the ceiling

-- Split bills: same vendor, same day, each individually under a limit, together over it.
create or replace view fin_anomaly_split_bills with (security_invoker = true) as
  with limits as (
    select company_id, min(approval_limit) as lowest_limit
      from fin_roles where approval_limit is not null
     group by company_id
  )
  select b.company_id,
         'split_bills'::text as kind,
         b.vendor_id,
         v.name              as vendor_name,
         b.bill_date,
         count(*)            as bill_count,
         sum(b.total)        as combined_total,
         l.lowest_limit,
         format(
           '%s separate bills from %s on the same day, each under the %s approval limit but totalling %s. '
           || 'Splitting one purchase into several is how an approval ceiling is defeated without ever '
           || 'breaking it — every individual approval here was legitimate.',
           count(*), coalesce(v.name, 'this vendor'),
           to_char(l.lowest_limit, 'FM999,999,990.00'),
           to_char(sum(b.total), 'FM999,999,990.00')
         ) as reason
    from fin_bill_summary b
    join limits l on l.company_id = b.company_id
    left join fin_vendors v on v.id = b.vendor_id
   where b.status in ('approved','paid')
     and b.total < l.lowest_limit
   group by b.company_id, b.vendor_id, v.name, b.bill_date, l.lowest_limit
  having count(*) > 1
     and sum(b.total) > l.lowest_limit;

-- ─── 3: a brand-new vendor, paid immediately, at material size ────────
create or replace view fin_anomaly_new_vendor_payment with (security_invoker = true) as
  select p.company_id,
         'new_vendor_fast_payment'::text as kind,
         p.id        as payment_id,
         p.vendor_id,
         v.name      as vendor_name,
         p.payment_date,
         p.amount,
         v.created_at as vendor_created_at,
         format(
           '%s was added as a vendor and paid %s within %s days. A vendor created and paid in the same '
           || 'week is the classic shape of invoice fraud — worth thirty seconds of a human''s attention, '
           || 'and nothing more than that if it checks out.',
           v.name,
           to_char(p.amount, 'FM999,999,990.00'),
           greatest(0, (p.payment_date - v.created_at::date))
         ) as reason
    from fin_payments p
    join fin_vendors v on v.id = p.vendor_id
   where p.payment_date - v.created_at::date <= 7
     and p.amount >= 1000;   -- material only; a £40 first payment is not a story

-- ─── 4: a control that checks another control ─────────────────────────
-- The SoD guards (0118/0142) make this impossible today. This rule exists so that if a future migration
-- ever weakens one of them, the breach SURFACES rather than sitting silently in the ledger — balanced,
-- approved, and entirely wrong.
create or replace view fin_anomaly_sod_breach with (security_invoker = true) as
  -- created_by/approved_by live on the base table; the total lives on the summary view. Both are needed,
  -- so this one joins them.
  select b.company_id,
         'sod_breach'::text as kind,
         b.id as bill_id,
         s.total,
         b.created_by,
         b.approved_by,
         'The same person entered AND approved this bill. Segregation of duties should make this '
         || 'impossible — if this row exists, a control has been weakened somewhere, and every approval '
         || 'made under that gap is now in question.' as reason
    from fin_bills b
    join fin_bill_summary s on s.id = b.id
   where b.approved_by is not null
     and b.approved_by = b.created_by;

-- ─── One list a human actually reads ──────────────────────────────────
-- Deliberately NOT a scored feed. Every row is a fact with a reason, and the reason is what a controller
-- acts on. Ordering is by amount, because in the absence of a defensible severity model, the honest proxy
-- for "look at this first" is "this is the most money".
create or replace view fin_anomalies with (security_invoker = true) as
  select company_id, kind, bill_date as occurred_on, total as amount, vendor_name, reason
    from fin_anomaly_threshold_gaming
  union all
  select company_id, kind, bill_date, combined_total, vendor_name, reason
    from fin_anomaly_split_bills
  union all
  select company_id, kind, payment_date, amount, vendor_name, reason
    from fin_anomaly_new_vendor_payment
  union all
  select company_id, kind, null::date, total, null::text, reason
    from fin_anomaly_sod_breach;

-- No new tables: every view reads fin_bills / fin_payments / fin_vendors / fin_roles, all already
-- tenant-scoped and policy-covered. Anomalies are a LENS, not a queue of rows to manage — a stored
-- anomaly table would need dismissing, re-detecting, and reconciling, and would drift from the documents
-- it describes.
