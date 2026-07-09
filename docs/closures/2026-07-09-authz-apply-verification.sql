-- ─────────────────────────────────────────────────────────────────────────────
-- Post-apply verification for the 2026-07-09 queue (migrations 0101–0108, 0110, 0111).
-- 17 checks. (0109 task-overrun emit is a dormant feature fn — verified when its cron
--  is wired, not part of this security apply.)
--
-- WHY THIS EXISTS (verification discipline / feedback_migration_coupling_no_assert):
-- "Never assert a migration is applied without per-env verification." rls-audit
-- (static, scans the migration FILES) cannot see whether a given DATABASE actually
-- has these objects. Run this script IN EACH ENVIRONMENT (Supabase SQL editor →
-- your prod/staging project) AFTER applying the queue. Every row should read PASS.
-- Any FAIL means that migration did not land in this environment — apply it.
--
-- Read-only: this script only SELECTs from the catalog. Safe to run any time.
-- ─────────────────────────────────────────────────────────────────────────────

with checks(migration, fix, passed) as (

  -- 0101 — task_steps UPDATE gained a WITH CHECK (was USING-only → push-out)
  select '0101', 'task_steps - update has WITH CHECK',
    exists (select 1 from pg_policies
            where tablename = 'task_steps' and policyname = 'task_steps - update'
              and with_check is not null)

  -- 0102 — coaching_sessions UPDATE gained a WITH CHECK (agent_id push → ELO skew)
  union all select '0102', 'coaching_sessions - update has WITH CHECK',
    exists (select 1 from pg_policies
            where tablename = 'coaching_sessions' and policyname = 'coaching_sessions - update'
              and with_check is not null)

  -- 0103 — events INSERT actor pinned to self-or-null (actor-spoof)
  union all select '0103', 'events - all WITH CHECK constrains actor',
    exists (select 1 from pg_policies
            where tablename = 'events' and policyname = 'events - all'
              and with_check ilike '%actor%')

  -- 0104 — message author_id pinned to self-or-null (impersonation)
  union all select '0104', 'chat_messages - insert WITH CHECK constrains author_id',
    exists (select 1 from pg_policies
            where tablename = 'chat_messages' and policyname = 'chat_messages - insert'
              and with_check ilike '%author_id%')
  union all select '0104', 'support_messages - insert WITH CHECK constrains author_id',
    exists (select 1 from pg_policies
            where tablename = 'support_messages' and policyname = 'support_messages - insert'
              and with_check ilike '%author_id%')

  -- 0105 — resolutions for-all split into 3 + decided_by/reviewer pinned + keys frozen
  union all select '0105', 'resolutions - insert WITH CHECK constrains decided_by',
    exists (select 1 from pg_policies
            where tablename = 'resolutions' and policyname = 'resolutions - insert'
              and with_check ilike '%decided_by%')
  union all select '0105', 'resolutions - update WITH CHECK constrains reviewer',
    exists (select 1 from pg_policies
            where tablename = 'resolutions' and policyname = 'resolutions - update'
              and with_check ilike '%reviewer%')
  union all select '0105', 'old "resolutions - all" for-all policy is GONE (split applied)',
    not exists (select 1 from pg_policies
                where tablename = 'resolutions' and policyname = 'resolutions - all')
  union all select '0105', 'check_resolution_immutability freezes decided_by + company_id + problem_id',
    exists (select 1 from pg_proc
            where proname = 'check_resolution_immutability'
              and prosrc ilike '%decided_by%' and prosrc ilike '%company_id%'
              and prosrc ilike '%problem_id%')

  -- 0106 — support_resolutions captured_by pinned to self-or-null
  union all select '0106', 'support_resolutions - insert WITH CHECK constrains captured_by',
    exists (select 1 from pg_policies
            where tablename = 'support_resolutions' and policyname = 'support_resolutions - insert'
              and with_check ilike '%captured_by%')

  -- 0107 — notification_subscriptions + care_agent_state company_id no longer mutable
  union all select '0107', 'notification_subscriptions_update_own WITH CHECK pins company_id',
    exists (select 1 from pg_policies
            where tablename = 'notification_subscriptions'
              and policyname = 'notification_subscriptions_update_own'
              and with_check ilike '%company_id%')
  union all select '0107', 'guard_care_agent_state_admin_cols freezes company_id',
    exists (select 1 from pg_proc
            where proname = 'guard_care_agent_state_admin_cols'
              and prosrc ilike '%company_id is immutable%')

  -- 0108 — problems + company_brain are no longer member-deletable (§3.1 immutability)
  union all select '0108', 'problems_no_delete rule exists',
    exists (select 1 from pg_rules
            where tablename = 'problems' and rulename = 'problems_no_delete')
  union all select '0108', 'company_brain_no_delete rule exists',
    exists (select 1 from pg_rules
            where tablename = 'company_brain' and rulename = 'company_brain_no_delete')

  -- 0111 — §3.4 control-window columns (companies.ai_guidance_*) frozen vs non-admin
  union all select '0111', 'companies_guard_guidance trigger exists',
    exists (select 1 from pg_trigger
            where tgname = 'companies_guard_guidance' and not tgisinternal)
  union all select '0111', 'guard_company_guidance_columns freezes ai_guidance_enabled',
    exists (select 1 from pg_proc
            where proname = 'guard_company_guidance_columns'
              and prosrc ilike '%ai_guidance_enabled%')

  -- 0110 — Experience Mode feature migration (not authz, but bundled in the same apply):
  -- if profiles.experience_mode is missing, the whole feature is dead (getExperienceMode
  -- reads a non-existent column, PATCH fails), so confirm it landed in the one-shot check.
  union all select '0110', 'profiles.experience_mode column exists (Experience Mode feature)',
    exists (select 1 from information_schema.columns
            where table_name = 'profiles' and column_name = 'experience_mode')
  -- (0109 task_overrun emit fn is intentionally NOT checked here — it's a dormant feature
  --  function, verified when its cron is wired, not part of this security apply.)
)
select
  migration,
  case when passed then 'PASS' else 'FAIL — apply this migration' end as status,
  fix
from checks
order by migration, fix;

-- Expected: every row PASS. A single query, so you can eyeball the FAILs at a glance.
-- (Reminder: these check the SHAPE of each object — presence + the key predicate.
--  They do not exercise the policy against a live session; for that, the smoke
--  tests in the closure doc remain the founder's confirmation step.)
