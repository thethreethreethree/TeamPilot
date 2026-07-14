-- 0177 — PHASE 4: NET PROFITABILITY BY SEGMENT + IDLE-RESOURCE TRACKING.
--
-- Two features, one migration, because they answer two halves of the same question: WHERE IS THE MONEY
-- GOING, AND WHAT IS IT BUYING?
--
-- ── 1. NET profitability by segment — the word NET is doing all the work ─────────────────────
--
-- 0148 gave contribution margin by customer, project and cost centre: revenue minus DIRECT cost. Every one
-- of those figures is flattering, because no customer pays the rent. A company reading them sees a roster
-- of profitable customers and cannot understand why the bank balance keeps falling.
--
-- NET profitability loads each segment with its share of overhead (0173's direct-cost driver). The
-- difference between the two numbers is frequently the difference between "our biggest customer" and "the
-- customer we are subsidising".
--
-- WHERE OVERHEAD CANNOT BE ALLOCATED, THE NET FIGURE IS NULL — never the gross one. Falling back to the
-- unloaded number under a heading that says "net" would report a customer as profitable at the exact moment
-- we could not work out what serving them cost. That is the same refusal as 0173 and 0176, and it is the
-- only honest behaviour available.
--
-- ── 2. Idle resources — the cost that produces nothing ───────────────────────────────────────
--
-- This one is a genuine judgment call, so the judgment is stated rather than hidden:
--
--   A cost centre or project that consumed money and produced NO revenue is NOT automatically waste.
--   R&D consumes and produces nothing for two years. So does a new market. So does the finance department.
--
-- A system that flagged those as "waste" would be confidently wrong about the most important spending a
-- company does, and a founder who trusted it would cut exactly the wrong things. So this view does NOT
-- judge. It reports a FACT — "this consumed £X and produced £0" — and leaves the interpretation to the
-- human, who knows whether that is R&D or a project everyone forgot to cancel.
--
-- The value is not the verdict. It is that nobody had noticed the £40,000 at all.
--
-- Idempotent (§A12). NOT VERIFIED against a live database. BUILT, not TESTED.

-- ─── Overhead absorbed per cost centre and per customer ───────────────
-- 0173 allocated overhead to PROJECTS. Cost centres and customers need the same treatment, driven the same
-- way (share of direct cost), so that every segment lens tells the same story. Two different drivers would
-- produce two different "truths" about the same overhead.
create or replace view fin_overhead_by_cost_center with (security_invoker = true) as
  with direct_by_cc as (
    select l.company_id,
           l.cost_center_id,
           date_trunc('month', e.entry_date)::date as month,
           sum(l.base_debit - l.base_credit) as direct_cost
      from fin_journal_lines l
      join fin_journal_entries e on e.id = l.entry_id and e.status = 'posted'
      join fin_accounts a        on a.id = l.account_id
     where a.type = 'expense' and a.cost_type = 'direct' and l.cost_center_id is not null
     group by 1, 2, 3
  ),
  totals as (
    select company_id, month, sum(direct_cost) as total_direct
      from direct_by_cc group by 1, 2
  )
  select d.company_id,
         d.cost_center_id,
         d.month,
         d.direct_cost,
         -- NULL, not 0, when there is nothing to divide by. A 0 would report every cost centre as carrying
         -- no overhead while the overhead sat unmentioned, and every segment would look better than it is.
         case when t.total_direct > 0
              then round(coalesce(o.overhead, 0) * (d.direct_cost / t.total_direct), 4)
         end::numeric(19,4) as allocated_overhead
    from direct_by_cc d
    join totals t on t.company_id = d.company_id and t.month = d.month
    left join fin_overhead_pool o on o.company_id = d.company_id and o.month = d.month;

-- ─── NET profitability by segment ─────────────────────────────────────
create or replace view fin_net_profit_by_cost_center with (security_invoker = true) as
  select p.company_id,
         p.cost_center_id,
         p.code,
         p.name,
         p.revenue,
         p.direct_cost,
         sum(o.allocated_overhead) as allocated_overhead,
         -- NULL when overhead is unknown. Never the gross margin under a "net" label.
         case when bool_and(o.allocated_overhead is not null)
              then (p.revenue - p.direct_cost - sum(o.allocated_overhead))::numeric(19,4)
         end as net_profit
    from fin_cost_center_profitability p
    left join fin_overhead_by_cost_center o
      on o.company_id = p.company_id and o.cost_center_id = p.cost_center_id
   group by p.company_id, p.cost_center_id, p.code, p.name, p.revenue, p.direct_cost;

-- Customer-level net profit rolls up through the customer's projects — the same path 0148 used, so the two
-- views cannot disagree about which project belongs to which customer.
create or replace view fin_net_profit_by_customer with (security_invoker = true) as
  select pr.company_id,
         pr.customer_id,
         c.name as customer_name,
         sum(l.revenue)            as revenue,
         sum(l.direct_cost)        as direct_cost,
         sum(l.allocated_overhead) as allocated_overhead,
         case when bool_and(l.allocated_overhead is not null)
              then (sum(l.revenue) - sum(l.direct_cost) - sum(l.allocated_overhead))::numeric(19,4)
         end as net_profit
    from fin_project_profit_loaded l
    join fin_projects  pr on pr.id = l.project_id
    join fin_customers c  on c.id  = pr.customer_id
   group by pr.company_id, pr.customer_id, c.name;

-- ─── Idle resources: cost that produced nothing ───────────────────────
-- Reports the FACT, never a verdict. See the header: R&D consumes and produces nothing for two years, and
-- a system that called that "waste" would be confidently wrong about the most important money a company
-- spends — and a founder who trusted it would cut precisely the wrong things.
create or replace view fin_idle_resources with (security_invoker = true) as
  select p.company_id,
         'project'::text  as kind,
         p.project_id     as id,
         p.name,
         p.total_cost     as cost_consumed,
         p.revenue,
         -- How long it has been silent. A project idle for one month is a Tuesday; one idle for nine is a
         -- question nobody has asked.
         (select max(e.entry_date)
            from fin_journal_lines l
            join fin_journal_entries e on e.id = l.entry_id and e.status = 'posted'
           where l.project_id = p.project_id) as last_activity
    from fin_project_profitability p
   where p.total_cost > 0
     and p.revenue = 0

  union all

  select c.company_id,
         'cost_center',
         c.cost_center_id,
         c.name,
         c.total_cost,
         c.revenue,
         (select max(e.entry_date)
            from fin_journal_lines l
            join fin_journal_entries e on e.id = l.entry_id and e.status = 'posted'
           where l.cost_center_id = c.cost_center_id)
    from fin_cost_center_profitability c
   where c.total_cost > 0
     and c.revenue = 0;

-- Fully-depreciated assets still on the books (0166). Not waste either — a paid-off machine still running
-- is the best asset a company owns. But an asset fully depreciated AND disposed of nowhere is worth a look:
-- it is either quietly still earning, or it left the building years ago and nobody told the ledger.
create or replace view fin_fully_depreciated_assets with (security_invoker = true) as
  select a.company_id,
         a.id as asset_id,
         a.name,
         a.cost,
         a.salvage_value,
         coalesce(sum(d.amount), 0) as accumulated
    from fin_fixed_assets a
    left join fin_depreciation_entries d on d.asset_id = a.id
   where a.disposed_date is null
   group by a.id, a.company_id, a.name, a.cost, a.salvage_value
  having coalesce(sum(d.amount), 0) >= (a.cost - a.salvage_value);
