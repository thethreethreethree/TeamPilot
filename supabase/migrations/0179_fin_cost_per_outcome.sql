-- 0179 — PHASE 4: COST PER OUTCOME (the ledger meets the diagnosis chain).
--
-- ── THE MEASUREMENT THIS FEATURE REFUSES TO MAKE ─────────────────────────────────────────────
--
-- The easy build: total operating spend ÷ problems resolved this quarter. Both numbers are real, the
-- division works, and the result is a confident, quotable "£4,200 per resolution".
--
-- It is meaningless, and worse than meaningless — it is ACTIVELY CORRUPTING. Because the moment a team is
-- measured on cost-per-resolution, the cheapest way to improve the number is to RESOLVE MORE PROBLEMS: to
-- close things faster, mark them done, move on. The metric rewards throughput and cannot tell the
-- difference between a problem that was fixed and a problem that was closed.
--
-- The ledger would show the number improving. Everybody would be doing exactly what they were asked. And
-- the same problems would keep coming back, each one closed a little faster than the last.
--
-- That is §3.5 exactly: measuring AGREEMENT (was it marked resolved?) instead of CONSEQUENCE (did it stay
-- fixed?) is grading your own homework. It is forbidden.
--
-- ── SO THE DENOMINATOR IS A *DURABLE* RESOLUTION ─────────────────────────────────────────────
--
-- resolutions.durability already records what actually happened: 'held' | 'reopened' | 'partial' |
-- 'unknown'. Only 'held' is an OUTCOME. A resolution that reopened is not a cheaper outcome — it is money
-- that bought nothing, and it must be reported as such, separately, by name.
--
-- The two figures this migration produces are therefore:
--
--   COST PER OUTCOME THAT HELD   — what it actually costs this company to fix something permanently.
--   MONEY SPENT ON FIXES THAT REOPENED — the cost of the illusion of progress.
--
-- The second number is the one that changes behaviour, and no system that measures cost-per-resolution can
-- ever produce it.
--
-- ── AND WE DO NOT INVENT THE ATTRIBUTION ─────────────────────────────────────────────────────
--
-- Cost can only be attributed to a problem if a HUMAN TAGGED IT. So this adds problem_id as a dimension on
-- journal lines — exactly as 0147 added cost_center_id and project_id (§A28: the precedent exists; follow
-- it rather than inventing a second mechanism).
--
-- Spend that nobody tagged is NOT spread across the problems to make the maths come out. It is reported as
-- UNTAGGED. Spreading it would let the cost-per-outcome figure look precise while resting on an assumption
-- nobody made — and every refusal in this financial system has been a version of that same discipline.
--
-- Idempotent (§A12). NOT VERIFIED against a live database. BUILT, not TESTED.

-- ─── The dimension (mirrors 0147 exactly) ─────────────────────────────
alter table fin_journal_lines add column if not exists problem_id uuid references problems(id) on delete set null;
alter table fin_bill_lines    add column if not exists problem_id uuid references problems(id) on delete set null;
alter table fin_expense_items add column if not exists problem_id uuid references problems(id) on delete set null;
create index if not exists fin_lines_problem_idx on fin_journal_lines (problem_id) where problem_id is not null;

-- ─── Cost attributed to each problem ──────────────────────────────────
create or replace view fin_cost_by_problem with (security_invoker = true) as
  select l.company_id,
         l.problem_id,
         p.title                                        as problem_title,
         sum(l.base_debit - l.base_credit)::numeric(19,4) as cost
    from fin_journal_lines l
    join fin_journal_entries e on e.id = l.entry_id and e.status = 'posted'
    join fin_accounts a        on a.id = l.account_id
    join problems p            on p.id = l.problem_id
   where a.type = 'expense'
     and l.problem_id is not null
   group by l.company_id, l.problem_id, p.title;

-- ─── Cost per OUTCOME — and the cost of fixes that did not hold ───────
create or replace view fin_cost_per_outcome with (security_invoker = true) as
  with tagged as (
    select c.company_id,
           c.problem_id,
           c.cost,
           -- A problem may carry several resolution attempts. The LATEST review is the one that tells us
           -- whether the money worked, because it is the most recent evidence of consequence.
           (select r.durability
              from resolutions r
             where r.problem_id = c.problem_id
             order by r.reviewed_at desc nulls last, r.decided_at desc
             limit 1) as durability
      from fin_cost_by_problem c
  )
  select company_id,

         -- ── THE HEADLINE. Only outcomes that HELD count as outcomes. ──
         count(*) filter (where durability = 'held')                      as outcomes_held,
         sum(cost) filter (where durability = 'held')::numeric(19,4)      as cost_of_held,
         -- NULL, not 0, when nothing has held yet. A 0 here would read as "it costs us nothing to fix
         -- things", which is the most flattering possible reading of "we have never actually fixed one".
         case when count(*) filter (where durability = 'held') > 0
              then round(sum(cost) filter (where durability = 'held')
                         / count(*) filter (where durability = 'held'), 2)
         end::numeric(19,4)                                               as cost_per_outcome,

         -- ── THE NUMBER THAT CHANGES BEHAVIOUR. ──
         -- Money spent on fixes that came back. No cost-per-resolution metric can ever produce this,
         -- because to that metric a reopened problem is simply another resolution to be counted.
         count(*) filter (where durability = 'reopened')                  as fixes_that_reopened,
         coalesce(sum(cost) filter (where durability = 'reopened'), 0)::numeric(19,4)
                                                                          as cost_of_reopened,

         count(*) filter (where durability = 'partial')                   as partial_fixes,
         -- Not yet reviewed. Deliberately its own bucket: an unreviewed resolution is not a success, and
         -- folding it into 'held' is exactly how a system starts grading its own homework (§3.5).
         count(*) filter (where durability is null or durability = 'unknown') as not_yet_known
    from tagged
   group by company_id;

-- ─── What we could NOT attribute — reported, never spread ─────────────
-- Untagged spend is the honest limit of this metric. Spreading it across the tagged problems would make
-- cost-per-outcome look precise while resting on an assumption nobody made. The percentage is the reader's
-- guide to how much the headline is worth: 90% untagged means the headline is a curiosity, not a finding.
create or replace view fin_cost_attribution_coverage with (security_invoker = true) as
  select l.company_id,
         sum(l.base_debit - l.base_credit) filter (where l.problem_id is not null)::numeric(19,4) as tagged_cost,
         sum(l.base_debit - l.base_credit) filter (where l.problem_id is null)::numeric(19,4)     as untagged_cost,
         case when sum(l.base_debit - l.base_credit) > 0
              then round(
                     coalesce(sum(l.base_debit - l.base_credit) filter (where l.problem_id is not null), 0)
                     / sum(l.base_debit - l.base_credit), 4)
         end as tagged_share
    from fin_journal_lines l
    join fin_journal_entries e on e.id = l.entry_id and e.status = 'posted'
    join fin_accounts a        on a.id = l.account_id
   where a.type = 'expense'
   group by l.company_id;

-- No RLS statements needed: fin_journal_lines and problems are both already tenant-scoped and
-- policy-covered, and every view above is security_invoker.
