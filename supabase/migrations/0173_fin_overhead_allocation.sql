-- 0173 — PHASE 4: OVERHEAD ALLOCATION (ANALYTICAL ONLY — founder-confirmed 2026-07-14).
--
-- ── THE CONFIRMED DECISION, AND WHY IT IS THE RIGHT ONE ──────────────────────────────────────
--
-- Overhead allocation answers: "the rent is £5,000 — how much of it did Project A consume?" Every ERP has
-- an answer. There are two ways to give one, and the difference is not technical taste.
--
-- POSTED allocation (the ERP-standard, REJECTED): the allocation posts real journal entries moving cost
-- from Rent into Project A and Project B, with a contra to balance. The GL now contains entries THAT NO
-- DOCUMENT BACKS. An auditor asking "what invoice supports this £3,000 line?" gets no answer, because none
-- exists — it is an opinion about how to divide a real cost. Worse, when the allocation driver changes (and
-- it always does — headcount shifts, a project ends), history must be REVERSED AND REPOSTED, sometimes into
-- a closed period, which the ledger correctly refuses.
--
-- ANALYTICAL allocation (CONFIRMED): the GL records only what actually happened — rent was £5,000, and an
-- invoice supports it. The allocation lives in a VIEW. Change the driver and the numbers simply re-run.
-- Nothing to unwind, nothing to reverse, no un-backed entries, and the general ledger remains what §3.1
-- requires it to be: a record of events, not a record of interpretations.
--
--   The ledger holds facts. The views hold opinions. Never let an opinion into the ledger.
--
-- This is the same principle as 0170 (the 1099 is a lens, not a second copy) and 0171 (a report is a
-- projection, not stored SQL). A materialized allocation would be a second copy of the truth that drifts
-- from the truth it claims to summarize.
--
-- ── THE DRIVER (founder-confirmed earlier): DIRECT-COST SHARE ────────────────────────────────
-- A project's share of overhead = its share of total DIRECT cost. If Project A consumed 60% of the direct
-- costs, it absorbs 60% of the overhead. fin_accounts.cost_type ('direct' | 'indirect' | 'none') from 0147
-- is what makes this computable — it already classifies every account.
--
-- Idempotent (§A12). NOT VERIFIED against a live database. BUILT, not TESTED.

-- ─── Direct cost per project, per period ──────────────────────────────
create or replace view fin_direct_cost_by_project with (security_invoker = true) as
  select l.company_id,
         l.project_id,
         e.entry_date,
         sum(l.base_debit - l.base_credit) as direct_cost
    from fin_journal_lines l
    join fin_journal_entries e on e.id = l.entry_id and e.status = 'posted'
    join fin_accounts a        on a.id = l.account_id
   where a.type = 'expense'
     and a.cost_type = 'direct'
     and l.project_id is not null
   group by l.company_id, l.project_id, e.entry_date;

-- ─── The pool of overhead awaiting allocation ─────────────────────────
-- Indirect expense that carries NO project. (Indirect cost already tagged to a project was a deliberate
-- assignment by a human — we do not re-allocate what someone has already decided.)
create or replace view fin_overhead_pool with (security_invoker = true) as
  select l.company_id,
         date_trunc('month', e.entry_date)::date as month,
         sum(l.base_debit - l.base_credit)       as overhead
    from fin_journal_lines l
    join fin_journal_entries e on e.id = l.entry_id and e.status = 'posted'
    join fin_accounts a        on a.id = l.account_id
   where a.type = 'expense'
     and a.cost_type = 'indirect'
     and l.project_id is null
   group by l.company_id, date_trunc('month', e.entry_date);

-- ─── The allocation itself ────────────────────────────────────────────
create or replace view fin_overhead_allocation with (security_invoker = true) as
  with monthly_direct as (
    select company_id,
           project_id,
           date_trunc('month', entry_date)::date as month,
           sum(direct_cost) as direct_cost
      from fin_direct_cost_by_project
     group by company_id, project_id, date_trunc('month', entry_date)
  ),
  totals as (
    select company_id, month, sum(direct_cost) as total_direct
      from monthly_direct
     group by company_id, month
  )
  select d.company_id,
         d.project_id,
         p.name           as project_name,
         d.month,
         d.direct_cost,
         t.total_direct,
         o.overhead       as overhead_pool,
         -- THE SHARE. Guarded against a zero denominator — a month with overhead but NO direct cost cannot
         -- have its overhead divided by anything. It returns NULL, not 0.
         --
         -- 0 would be a LIE that balances: it would report every project as having absorbed no overhead
         -- while the overhead pool sat there, unallocated and unmentioned, and every project's margin would
         -- read as better than it is. NULL forces the question "why did we spend on overhead in a month
         -- with no direct project cost?" — which is exactly the question worth asking.
         case when t.total_direct > 0
              then round(o.overhead * (d.direct_cost / t.total_direct), 4)
         end::numeric(19,4) as allocated_overhead,
         case when t.total_direct > 0
              then round(d.direct_cost / t.total_direct, 6)
         end                as share
    from monthly_direct d
    join totals t on t.company_id = d.company_id and t.month = d.month
    left join fin_overhead_pool o on o.company_id = d.company_id and o.month = d.month
    left join fin_projects p      on p.id = d.project_id;

-- ─── The honest total: what did NOT get allocated? ────────────────────
-- Overhead in a month with no direct project cost is allocated to NOBODY. That remainder is REPORTED, never
-- absorbed — the same discipline as 0164's 'unclassified' cash-flow bucket and 0169's Opening Balance
-- Equity. A quietly-absorbed remainder makes every margin on the page look better than it is, and nothing
-- downstream would ever disagree.
create or replace view fin_overhead_unallocated with (security_invoker = true) as
  select o.company_id,
         o.month,
         o.overhead as unallocated_overhead
    from fin_overhead_pool o
    left join (
      select company_id, date_trunc('month', entry_date)::date as month, sum(direct_cost) as td
        from fin_direct_cost_by_project
       group by company_id, date_trunc('month', entry_date)
    ) t on t.company_id = o.company_id and t.month = o.month
   where coalesce(t.td, 0) <= 0
     and o.overhead <> 0;

-- ─── Fully-loaded project profitability ───────────────────────────────
-- 0148 gave project margin on DIRECT cost only. That figure systematically FLATTERS every project, because
-- no project pays rent. This view adds the overhead each project absorbed — which is the number a founder
-- should be reading before they decide a project is worth doing again.
-- NOTE: 0148's fin_project_profitability is LIFETIME (no month dimension), so this view computes monthly
-- revenue itself rather than joining a month column that does not exist there. Checked, not assumed.
create or replace view fin_project_profit_loaded with (security_invoker = true) as
  with monthly_revenue as (
    select l.company_id,
           l.project_id,
           date_trunc('month', e.entry_date)::date as month,
           sum(l.base_credit - l.base_debit) as revenue
      from fin_journal_lines l
      join fin_journal_entries e on e.id = l.entry_id and e.status = 'posted'
      join fin_accounts a        on a.id = l.account_id
     where a.type = 'revenue' and l.project_id is not null
     group by l.company_id, l.project_id, date_trunc('month', e.entry_date)
  )
  select a.company_id,
         a.project_id,
         a.project_name,
         a.month,
         coalesce(r.revenue, 0)::numeric(19,4) as revenue,
         a.direct_cost,
         a.allocated_overhead,
         -- If overhead could not be allocated (NULL), the loaded margin is NULL too — NOT the direct
         -- margin. Silently falling back to the direct margin would present an UNLOADED figure under a
         -- "fully loaded" label, which is the single most misleading thing this view could do: it would
         -- report a project as profitable at exactly the moment we could not work out what it cost.
         (coalesce(r.revenue, 0) - a.direct_cost - a.allocated_overhead)::numeric(19,4) as loaded_margin
    from fin_overhead_allocation a
    left join monthly_revenue r
      on r.company_id = a.company_id and r.project_id = a.project_id and r.month = a.month;

-- No RLS statements: every view above reads fin_journal_lines / fin_accounts / fin_projects, all of which
-- are already tenant-scoped and policy-covered. No new table is introduced, so no new policy surface is
-- created — which is the whole point of an analytical allocation.
