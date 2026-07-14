-- 0173 acceptance — OVERHEAD ALLOCATION (analytical). Staging, 0116–0173 applied.
--
-- The founder confirmed ANALYTICAL allocation: the GL records what happened, the views record how we think
-- about it. So the first assertion here is a NEGATIVE one — the thing this feature must never do.

begin;

do $$
declare v_before int; v_after int;
begin
  -- ── 1 · THE ALLOCATION MUST NOT TOUCH THE LEDGER ──
  -- Analytical allocation means the GL is untouched. If reading the allocation views ever caused a journal
  -- line to exist, the ledger would contain entries THAT NO DOCUMENT BACKS — an auditor asking "what
  -- invoice supports this £3,000?" would get no answer, because it is an opinion, not an event.
  select count(*) into v_before from fin_journal_lines;
  perform * from fin_overhead_allocation limit 100;
  perform * from fin_project_profit_loaded limit 100;
  select count(*) into v_after from fin_journal_lines;

  if v_before = v_after then
    raise notice 'ALLOC PASS: reading the allocation created NO journal lines — the GL holds facts, the views hold opinions';
  else
    raise notice 'ALLOC FAIL: the allocation wrote to the ledger. The GL now contains entries no document backs.';
  end if;

  -- The views must be security_invoker, or they leak every tenant's cost structure.
  if (select count(*) from pg_views v
       join pg_class c on c.relname = v.viewname
      where v.viewname in ('fin_overhead_allocation','fin_project_profit_loaded','fin_overhead_pool')
        and c.reloptions::text like '%security_invoker=true%') = 3
  then raise notice 'ALLOC PASS: all three views run as the INVOKER — no cross-tenant read';
  else raise notice 'ALLOC FAIL: a view runs as its owner and bypasses RLS — every company sees every other company''s cost structure';
  end if;
end $$;

rollback;

-- ══ APP-LAYER ═══════════════════════════════════════════════════════════════════════════════
--
-- SETUP: one month. Project A direct cost 6,000. Project B direct cost 4,000. Rent (indirect, no project)
-- 5,000. Total direct = 10,000.
--
-- 2 · THE DRIVER IS DIRECT-COST SHARE (founder-confirmed).
--     → Project A: share 0.60, allocated_overhead = 3,000.00
--     → Project B: share 0.40, allocated_overhead = 2,000.00
--     → The two allocations MUST sum to the full 5,000 pool. Overhead that vanishes between the pool and
--       the projects is overhead nobody is paying for, and every margin on the page is then too good.
--
-- 3 · UNALLOCATABLE OVERHEAD IS REPORTED, NEVER ABSORBED.  ***THE ASSERTION THIS FILE EXISTS FOR.***
--     A month with rent of 5,000 and NO direct project cost at all (total_direct = 0).
--     → allocated_overhead MUST be NULL for every project — not 0.
--     → fin_overhead_unallocated MUST show 5,000.00 for that month.
--
--     ZERO IS THE FAILING CONDITION, and it is a lie that balances: it reports every project as having
--     absorbed no overhead while 5,000 of real, invoiced cost sits unmentioned. Every project's margin
--     reads better than it is, the numbers all tie out, and nothing downstream disagrees. The founder then
--     decides a project is worth repeating on the strength of a margin that ignored the rent.
--
--     Same discipline as 0164's 'unclassified' cash-flow bucket and 0169's Opening Balance Equity: the
--     remainder gets a NAME, not a quiet home.
--
-- 4 · LOADED MARGIN IS NULL WHEN OVERHEAD IS UNKNOWN — never the direct margin.
--     For the month in test 3: fin_project_profit_loaded.loaded_margin MUST be NULL.
--     Falling back to the direct margin would present an UNLOADED figure under a "fully loaded" label —
--     reporting a project as profitable at the exact moment we could not work out what it cost. That is
--     the single most misleading thing this view could do, and it would look completely normal.
--
-- 5 · DIRECT COST ALREADY TAGGED TO A PROJECT IS NOT RE-ALLOCATED.
--     Tag an INDIRECT expense to Project A explicitly. It MUST NOT enter the overhead pool — a human
--     already decided where it belongs, and re-dividing it would overrule them silently.
--
-- 6 · ONLY POSTED ENTRIES.  A draft bill MUST NOT move any project's overhead share. Otherwise anyone with
--     entry rights could shift cost between projects, changing every margin, with no approval and no trace.
--
-- 7 · TENANT ISOLATION.  As company B, select from fin_overhead_allocation.
--     → MUST return ONLY company B's rows. (This is the 2026-07-14 security fix: these views originally
--     shipped without security_invoker and would have returned EVERY company's cost structure.)
