-- ─────────────────────────────────────────────────────────────────────────────
-- Post-apply verification for migration 0112 (item-12: brain writes DEFINER + RLS restrict).
--
-- Run this IN STAGING after applying 0112, to confirm the objects changed shape as intended
-- — THEN run the behavioral test (create a test company, run a learning cycle, confirm the
-- brain still composes) before promoting to prod. This script checks SHAPE only; it does not
-- exercise the learning cycle. Kept SEPARATE from the 0101-0111 verifier because 0112 is
-- staging-gated, not part of that safe batch.
--
-- Read-only: only SELECTs from the catalog. Every row should read PASS.
-- ─────────────────────────────────────────────────────────────────────────────

with checks(check_name, passed) as (

  -- 1. record_brain_learning is now SECURITY DEFINER (was invoker)
  select 'record_brain_learning is SECURITY DEFINER',
    exists (select 1 from pg_proc
            where proname = 'record_brain_learning' and prosecdef = true)

  -- 2. record_brain_learning has search_path pinned (per 0096 — definer must not float)
  union all select 'record_brain_learning has search_path=public pinned',
    exists (select 1 from pg_proc
            where proname = 'record_brain_learning'
              and array_to_string(proconfig, ',') ilike '%search_path=public%')

  -- 3. create_empty_brain_for_company is now SECURITY DEFINER (trigger must write past RLS)
  union all select 'create_empty_brain_for_company is SECURITY DEFINER',
    exists (select 1 from pg_proc
            where proname = 'create_empty_brain_for_company' and prosecdef = true)

  -- 4. create_empty_brain_for_company has search_path pinned
  union all select 'create_empty_brain_for_company has search_path=public pinned',
    exists (select 1 from pg_proc
            where proname = 'create_empty_brain_for_company'
              and array_to_string(proconfig, ',') ilike '%search_path=public%')

  -- 5. company_brain: the old member-writable "for all" policy is GONE
  union all select 'company_brain: old "- all" (member-writable) policy removed',
    not exists (select 1 from pg_policies
                where tablename = 'company_brain' and policyname = 'company_brain - all')

  -- 6. company_brain: a SELECT policy exists (members can still read)
  union all select 'company_brain: SELECT policy present',
    exists (select 1 from pg_policies
            where tablename = 'company_brain' and policyname = 'company_brain - select'
              and cmd = 'SELECT')

  -- 7. company_brain: NO member INSERT/UPDATE/ALL policy (direct writes default-denied →
  --    closes the prompt-injection vector; DEFINER paths still write)
  union all select 'company_brain: no member INSERT/UPDATE/ALL policy (writes locked to DEFINER path)',
    not exists (select 1 from pg_policies
                where tablename = 'company_brain' and cmd in ('INSERT','UPDATE','ALL'))

  -- 8. brain_evolution_events: old "for all" policy gone, SELECT-only remains
  union all select 'brain_evolution_events: old "- all" policy removed',
    not exists (select 1 from pg_policies
                where tablename = 'brain_evolution_events' and policyname = 'brain_evolution_events - all')
  union all select 'brain_evolution_events: SELECT policy present, no INSERT/UPDATE/ALL',
    exists (select 1 from pg_policies
            where tablename = 'brain_evolution_events' and cmd = 'SELECT')
    and not exists (select 1 from pg_policies
                    where tablename = 'brain_evolution_events' and cmd in ('INSERT','UPDATE','ALL'))

  -- 9. Append-only invariants still intact (0007 rules survive — RLS change must not drop them)
  union all select 'brain_evolution_events append-only rules intact (no_update + no_delete)',
    (select count(*) from pg_rules
     where tablename = 'brain_evolution_events'
       and rulename in ('brain_evolution_no_update','brain_evolution_no_delete')) = 2

  -- 10. 0108 company_brain no-delete rule still present (nothing here should have dropped it)
  union all select 'company_brain_no_delete rule still present (0108)',
    exists (select 1 from pg_rules
            where tablename = 'company_brain' and rulename = 'company_brain_no_delete')
)
select
  case when passed then 'PASS' else 'FAIL — 0112 did not apply as intended' end as status,
  check_name
from checks
order by check_name;

-- Expected: every row PASS. A FAIL means 0112's shape is wrong in this env — do NOT
-- promote; re-check the migration applied cleanly. After all PASS, run the BEHAVIORAL
-- test (test company + learning cycle) — shape-correct is necessary but not sufficient.
