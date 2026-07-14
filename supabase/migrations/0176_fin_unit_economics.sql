-- 0176 — PHASE 4: UNIT ECONOMICS & BREAK-EVEN.
--
-- ── THE NUMBER THIS FILE EXISTS TO REFUSE TO PRINT ───────────────────────────────────────────
--
-- Break-even revenue = fixed costs ÷ contribution-margin ratio.
--
-- Every spreadsheet in the world implements exactly that, and it contains a trap that is invisible until
-- it has already done its damage:
--
--   WHEN THE CONTRIBUTION MARGIN IS NEGATIVE — when each additional sale costs more to deliver than it
--   brings in — THE FORMULA STILL DIVIDES. It returns a large, finite, entirely plausible number, and a
--   founder reads it as "sell £480,000 and we're fine."
--
--   The truth is the exact opposite: at a negative contribution margin, EVERY SALE MAKES THE LOSS BIGGER.
--   There is no volume that saves the company. Growth is the accelerant, not the cure. And the spreadsheet
--   has just told them to grow.
--
-- This is the most dangerous single number in a financial system, because it is wrong in the direction of
-- ACTION — it does not merely mislead, it instructs. So this migration returns NULL there, and the surface
-- says, in words, what a NULL means: "you cannot break even at any volume; each sale increases the loss."
--
-- Same discipline, third time this session: a zero, or a big finite number, is a lie that balances. NULL
-- forces the question.
--
-- ── THE MODELLING CHOICE, STATED RATHER THAN BURIED ──────────────────────────────────────────
--
-- Break-even needs a FIXED / VARIABLE split. This system has a DIRECT / INDIRECT split (fin_accounts
-- .cost_type, 0147). They are not the same distinction, and pretending otherwise silently is how a
-- reasonable-looking model becomes wrong.
--
--   direct   → treated as VARIABLE  (scales with the work: materials, contractor time, delivery cost)
--   indirect → treated as FIXED     (does not scale with one more sale: rent, salaries, software)
--
-- That proxy is defensible for a services business and WRONG for some others (a salaried delivery team is
-- direct but not variable). So this is not hidden inside a formula — fin_break_even exposes the fixed and
-- variable totals it used, and the UI names the assumption. A user who disagrees can see exactly which
-- number to argue with, which is the only way a model earns trust.
--
-- Idempotent (§A12). NOT VERIFIED against a live database. BUILT, not TESTED.

-- ─── Revenue, variable cost, fixed cost — per month, from posted lines ─
create or replace view fin_cost_behaviour with (security_invoker = true) as
  select l.company_id,
         date_trunc('month', e.entry_date)::date as month,
         sum(case when a.type = 'revenue'
                  then l.base_credit - l.base_debit else 0 end)::numeric(19,4) as revenue,
         sum(case when a.type = 'expense' and a.cost_type = 'direct'
                  then l.base_debit - l.base_credit else 0 end)::numeric(19,4) as variable_cost,
         sum(case when a.type = 'expense' and a.cost_type <> 'direct'
                  then l.base_debit - l.base_credit else 0 end)::numeric(19,4) as fixed_cost
    from fin_journal_lines l
    join fin_journal_entries e on e.id = l.entry_id and e.status = 'posted'
    join fin_accounts a        on a.id = l.account_id
   where a.type in ('revenue','expense')
   group by l.company_id, date_trunc('month', e.entry_date);

-- ─── Break-even ───────────────────────────────────────────────────────
create or replace view fin_break_even with (security_invoker = true) as
  select b.company_id,
         b.month,
         b.revenue,
         b.variable_cost,
         b.fixed_cost,
         (b.revenue - b.variable_cost)::numeric(19,4) as contribution,

         -- The ratio: what proportion of each pound of revenue is left after the cost of delivering it.
         -- NULL when there is no revenue — a ratio of "nothing per nothing" is not zero, it is undefined,
         -- and 0 here would propagate into a break-even of infinity dressed up as a number.
         case when b.revenue > 0
              then round((b.revenue - b.variable_cost) / b.revenue, 6)
         end as contribution_ratio,

         -- ── THE REFUSAL ──
         -- Only defined when each sale actually contributes something toward the fixed costs. If the
         -- contribution is zero or negative, there is NO revenue figure that breaks even: more sales make
         -- the loss larger. The formula would happily divide anyway and hand back a target. We do not.
         case
           when b.revenue > 0 and (b.revenue - b.variable_cost) > 0
             then round(b.fixed_cost / ((b.revenue - b.variable_cost) / b.revenue), 2)
         end::numeric(19,4) as break_even_revenue,

         -- Why the break-even is NULL, in words, so the surface never has to guess.
         case
           when b.revenue = 0
             then 'No revenue this month, so there is nothing to compute a break-even from.'
           when (b.revenue - b.variable_cost) <= 0
             then 'Each sale costs more to deliver than it brings in. THERE IS NO VOLUME THAT BREAKS EVEN — '
               || 'every additional sale makes the loss bigger. Selling more will not fix this; the price or '
               || 'the cost of delivery has to change first.'
         end as undefined_because
    from fin_cost_behaviour b;

-- ─── Unit economics, where a "unit" is a project ──────────────────────
-- We do not invent a unit. This system has no concept of a "customer acquisition" or a "widget", so a
-- per-unit metric would require inventing a denominator — and an invented denominator is a fabricated
-- number wearing a KPI's name. A PROJECT is the one unit this ledger genuinely knows about, because
-- humans tag lines with it.
create or replace view fin_unit_economics with (security_invoker = true) as
  with per_project as (
    select l.company_id,
           l.project_id,
           sum(case when a.type = 'revenue'
                    then l.base_credit - l.base_debit else 0 end)::numeric(19,4) as revenue,
           sum(case when a.type = 'expense' and a.cost_type = 'direct'
                    then l.base_debit - l.base_credit else 0 end)::numeric(19,4) as variable_cost
      from fin_journal_lines l
      join fin_journal_entries e on e.id = l.entry_id and e.status = 'posted'
      join fin_accounts a        on a.id = l.account_id
     where l.project_id is not null
     group by l.company_id, l.project_id
  )
  select p.company_id,
         p.project_id,
         pr.name as project_name,
         p.revenue,
         p.variable_cost,
         (p.revenue - p.variable_cost)::numeric(19,4) as contribution,
         case when p.revenue > 0
              then round((p.revenue - p.variable_cost) / p.revenue, 4)
         end as contribution_ratio,
         -- The single most important boolean here. A project that contributes NOTHING is one you should
         -- stop selling, not one you should sell more of — and it is invisible on a revenue-ranked list,
         -- where it may well sit near the top.
         (p.revenue - p.variable_cost) <= 0 as loses_money_per_sale
    from per_project p
    left join fin_projects pr on pr.id = p.project_id;

-- No new tables: every view reads posted journal lines + accounts + projects, all tenant-scoped and
-- policy-covered. Unit economics is a LENS, consistent with 0170/0171/0173/0175.
