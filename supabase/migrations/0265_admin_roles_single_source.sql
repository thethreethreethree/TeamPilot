-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0265 — the admin-role list stops being written down forty-eight times
-- ═════════════════════════════════════════════════════════════════════════════════════════════
--
-- FOUNDER RULING 2026-09-22: one source for the list, and the 47 policies call it.
--
-- THE DRIFT, as found. `src/lib/roles.ts` says:
--
--     export const ADMIN_ROLES = ["CEO", "CFO", "COO", "admin"] as const;
--
-- and 47 RLS policies across 36 tables say:
--
--     profiles.role = ANY (ARRAY['CEO'::text, 'COO'::text, 'admin'::text])
--
-- No CFO. So `isAdminRole("CFO")` is true — every admin surface renders, every route gated on
-- `ctx.isAdmin` lets them through — and the database refuses them on every RLS-gated admin write.
-- CFO is in INVITABLE_ROLES and in ORG_ROLE_OPTIONS, so that account can be created from the team
-- page today. The failure would be silent and misattributed: the control is there, the click does
-- nothing, and it reads as a broken feature rather than as a role that was never granted.
--
-- LATENT, NOT LIVE. Counted against production before writing this (founder-approved, counts only):
-- admin 10, Member 9, null 3, Manager 1, member 1 — 24 profiles, no CFO. Nobody is standing in it.
--
-- WHERE IT CAME FROM, and it is not carelessness. `roles.ts` records it: "'CFO' added 2026-08-29
-- with the org hierarchy (founder: C-Suite = admin)". ONE policy was updated that day and got it
-- right — `team_invitations - insert`, whose who-may-invite list is the complete four. The other
-- 47 copies of the same decision did not move. That is what forty-eight copies of one decision do.
--
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- WHAT THIS MIGRATION DELIBERATELY DOES NOT DO
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- It does not introduce `is_company_admin(company uuid)`, which was the shape first proposed.
--
-- The 47 policies share one literal but NOT the predicate around it. Most read
-- `profiles.company_id = <this table>.company_id`; `profile_departments` joins `profiles me` to
-- `profiles target` because the row carries no company_id of its own. A function taking the
-- company would unify two things: the admin-role list, which drifted, and the tenant-scope
-- expression, which did not. Hand-rewriting 47 tenant checks is precisely where a cross-tenant
-- read gets introduced — the failure A30 was captured from (19 views missing security_invoker).
--
-- So this changes ONE literal per policy and leaves every tenant check byte-for-byte as it was.
-- The property the founder asked for holds either way: the next role change is one line.
--
-- Re-runnable by construction (A12): `create or replace function`, and every policy is dropped
-- with `if exists` before being created. Each migration runs in its own transaction, so no policy
-- is ever absent from a live table outside that transaction.

-- The one place the admin-role list lives, from here on.
--
-- STABLE, not IMMUTABLE: it reads nothing, but IMMUTABLE would license the planner to fold it at
-- plan time and cache it across a definition change, and the entire point of this function is
-- that its definition will change again.
--
-- No SECURITY DEFINER. It touches no table, so there is nothing to elevate, and a definer
-- function inside 47 RLS policies is a much larger thing to get right than this needs to be.
create or replace function public.admin_roles()
returns text[]
language sql
stable
parallel safe
set search_path = public
as $$
  select array['CEO', 'CFO', 'COO', 'admin']::text[]
$$;

comment on function public.admin_roles() is
  'The company-admin role list, in one place. Mirrors ADMIN_ROLES in src/lib/roles.ts — see 0265 for why the two drifted and what it cost. Changing an admin role means editing this function and that constant, and nothing else.';

grant execute on function public.admin_roles() to public;

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- The 47 policies, re-emitted from pg_policies with the literal swapped for the call.
-- Generated, not hand-written: every surrounding condition is exactly what was there before.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

-- A NOTE ON THE FORM OF THESE STATEMENTS, because it is not cosmetic.
--
-- The generator originally emitted `create policy "x" on public.t AS PERMISSIVE for select …`,
-- which is what `pg_policies` reports and is exactly equivalent to omitting it (PERMISSIVE is the
-- Postgres default, and all 47 of these are permissive — checked, not assumed).
--
-- `scripts/rls-audit.mjs` would not have seen a single one of them. Its parser is
--
--     /create\s+policy\s+(?:"[^"]+"|\w+)\s+on\s+(?:public\.)?(\w+)\s+for\s+(select|insert|…)/
--
-- which requires `for <op>` to follow the table name immediately. `AS PERMISSIVE` in between and
-- all 47 policies disappear from the audit's model — it would have reported 36 tables as having
-- lost their coverage, on a migration that changed none of it. A gate that cannot see a policy
-- reports its absence, and an absence it invents is indistinguishable from one it found.
--
-- So the `AS PERMISSIVE` is omitted and the audit's parser is untouched. Verified by running that
-- exact regex over this file: 47 of 47.

drop policy if exists "agent_baseline - select own or manager" on public.agent_baseline;
create policy "agent_baseline - select own or manager" on public.agent_baseline for SELECT to public using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = agent_baseline.company_id) AND ((agent_baseline.agent_id = p.id) OR (p.role = ANY (admin_roles())) OR (p.sales_coach_role = 'admin'::text))))));

drop policy if exists "agent_point_ledger - owner or manager read" on public.agent_point_ledger;
create policy "agent_point_ledger - owner or manager read" on public.agent_point_ledger for SELECT to public using (((company_id = auth_company_id()) AND ((agent_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = agent_point_ledger.company_id) AND ((p.role = ANY (admin_roles())) OR (p.sales_coach_role = 'admin'::text))))))));

drop policy if exists "care_agent_state - admin insert" on public.care_agent_state;
create policy "care_agent_state - admin insert" on public.care_agent_state for INSERT to public with check (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = care_agent_state.company_id) AND (p.role = ANY (admin_roles()))))) AND (EXISTS ( SELECT 1
   FROM profiles a
  WHERE ((a.id = care_agent_state.agent_id) AND (a.company_id = care_agent_state.company_id))))));

drop policy if exists "care_agent_state - admin update" on public.care_agent_state;
create policy "care_agent_state - admin update" on public.care_agent_state for UPDATE to public using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = care_agent_state.company_id) AND (p.role = ANY (admin_roles())))))) with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = care_agent_state.company_id) AND (p.role = ANY (admin_roles()))))));

drop policy if exists "care_agent_state - select" on public.care_agent_state;
create policy "care_agent_state - select" on public.care_agent_state for SELECT to public using (((agent_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = care_agent_state.company_id) AND (p.role = ANY (admin_roles())))))));

drop policy if exists "care_knowledge_documents - insert" on public.care_knowledge_documents;
create policy "care_knowledge_documents - insert" on public.care_knowledge_documents for INSERT to public with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = care_knowledge_documents.company_id) AND (p.role = ANY (admin_roles()))))));

drop policy if exists "care_tenant_config - mutate" on public.care_tenant_config;
create policy "care_tenant_config - mutate" on public.care_tenant_config for ALL to public using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = care_tenant_config.company_id) AND (p.role = ANY (admin_roles()))))));

drop policy if exists "coaching_cues - select" on public.coaching_cues;
create policy "coaching_cues - select" on public.coaching_cues for SELECT to public using ((EXISTS ( SELECT 1
   FROM coaching_sessions s
  WHERE ((s.id = coaching_cues.session_id) AND ((s.agent_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM profiles p
          WHERE ((p.id = auth.uid()) AND (p.company_id = s.company_id) AND ((p.role = ANY (admin_roles())) OR (p.sales_coach_role = 'admin'::text))))))))));

drop policy if exists "coaching_sessions - select" on public.coaching_sessions;
create policy "coaching_sessions - select" on public.coaching_sessions for SELECT to public using (((agent_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = coaching_sessions.company_id) AND ((p.role = ANY (admin_roles())) OR (p.sales_coach_role = 'admin'::text)))))));

drop policy if exists "coaching_sessions - update" on public.coaching_sessions;
create policy "coaching_sessions - update" on public.coaching_sessions for UPDATE to public using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = coaching_sessions.company_id) AND ((coaching_sessions.agent_id = p.id) OR (p.role = ANY (admin_roles()))))))) with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = coaching_sessions.company_id) AND ((coaching_sessions.agent_id = p.id) OR (p.role = ANY (admin_roles())))))));

drop policy if exists "coaching_transcript_segments - select" on public.coaching_transcript_segments;
create policy "coaching_transcript_segments - select" on public.coaching_transcript_segments for SELECT to public using ((EXISTS ( SELECT 1
   FROM coaching_sessions s
  WHERE ((s.id = coaching_transcript_segments.session_id) AND ((s.agent_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM profiles p
          WHERE ((p.id = auth.uid()) AND (p.company_id = s.company_id) AND ((p.role = ANY (admin_roles())) OR (p.sales_coach_role = 'admin'::text))))))))));

drop policy if exists departments_insert_admin on public.departments;
create policy departments_insert_admin on public.departments for INSERT to public with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.company_id = departments.company_id) AND (profiles.role = ANY (admin_roles()))))));

drop policy if exists departments_update_admin on public.departments;
create policy departments_update_admin on public.departments for UPDATE to public using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.company_id = departments.company_id) AND (profiles.role = ANY (admin_roles()))))));

drop policy if exists "door_knocks - select" on public.door_knocks;
create policy "door_knocks - select" on public.door_knocks for SELECT to public using (((rep_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = door_knocks.company_id) AND ((p.role = ANY (admin_roles())) OR (p.sales_coach_role = 'admin'::text)))))));

drop policy if exists file_access_grants_delete on public.file_access_grants;
create policy file_access_grants_delete on public.file_access_grants for DELETE to public using ((EXISTS ( SELECT 1
   FROM files
  WHERE ((files.id = file_access_grants.file_id) AND ((files.uploader_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM profiles
          WHERE ((profiles.id = auth.uid()) AND (profiles.company_id = files.company_id) AND (profiles.role = ANY (admin_roles()))))))))));

drop policy if exists file_access_grants_insert on public.file_access_grants;
create policy file_access_grants_insert on public.file_access_grants for INSERT to public with check ((EXISTS ( SELECT 1
   FROM files
  WHERE ((files.id = file_access_grants.file_id) AND ((files.uploader_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM profiles
          WHERE ((profiles.id = auth.uid()) AND (profiles.company_id = files.company_id) AND (profiles.role = ANY (admin_roles()))))))))));

drop policy if exists file_suggestions_write on public.file_classification_suggestions;
create policy file_suggestions_write on public.file_classification_suggestions for ALL to public using ((EXISTS ( SELECT 1
   FROM files
  WHERE ((files.id = file_classification_suggestions.file_id) AND ((files.uploader_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM profiles
          WHERE ((profiles.id = auth.uid()) AND (profiles.company_id = files.company_id) AND (profiles.role = ANY (admin_roles()))))))))));

drop policy if exists file_departments_write on public.file_departments;
create policy file_departments_write on public.file_departments for ALL to public using ((EXISTS ( SELECT 1
   FROM files
  WHERE ((files.id = file_departments.file_id) AND ((files.uploader_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM profiles
          WHERE ((profiles.id = auth.uid()) AND (profiles.company_id = files.company_id) AND (profiles.role = ANY (admin_roles()))))))))));

drop policy if exists file_tags_write on public.file_tags;
create policy file_tags_write on public.file_tags for ALL to public using ((EXISTS ( SELECT 1
   FROM files
  WHERE ((files.id = file_tags.file_id) AND ((files.uploader_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM profiles
          WHERE ((profiles.id = auth.uid()) AND (profiles.company_id = files.company_id) AND (profiles.role = ANY (admin_roles()))))))))));

drop policy if exists file_tasks_write on public.file_tasks;
create policy file_tasks_write on public.file_tasks for ALL to public using ((EXISTS ( SELECT 1
   FROM files
  WHERE ((files.id = file_tasks.file_id) AND ((files.uploader_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM profiles
          WHERE ((profiles.id = auth.uid()) AND (profiles.company_id = files.company_id) AND (profiles.role = ANY (admin_roles()))))))))));

drop policy if exists files_select on public.files;
create policy files_select on public.files for SELECT to public using (((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND ((uploader_id = auth.uid()) OR
CASE access_role
    WHEN 'everyone'::text THEN true
    WHEN 'admins'::text THEN (EXISTS ( SELECT 1
       FROM profiles
      WHERE ((profiles.id = auth.uid()) AND (profiles.company_id = files.company_id) AND (profiles.role = ANY (admin_roles())))))
    WHEN 'ceo_admins'::text THEN (EXISTS ( SELECT 1
       FROM profiles
      WHERE ((profiles.id = auth.uid()) AND (profiles.company_id = files.company_id) AND (profiles.role = ANY (admin_roles())))))
    WHEN 'specific_people'::text THEN (EXISTS ( SELECT 1
       FROM file_access_grants
      WHERE ((file_access_grants.file_id = files.id) AND (file_access_grants.profile_id = auth.uid()))))
    ELSE false
END) AND (deprecated_at IS NULL)));

drop policy if exists files_update on public.files;
create policy files_update on public.files for UPDATE to public using (((uploader_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.company_id = files.company_id) AND (profiles.role = ANY (admin_roles()))))))) with check (((company_id = auth_company_id()) AND ((uploader_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.company_id = files.company_id) AND (profiles.role = ANY (admin_roles()))))))));

drop policy if exists "gamification_calibration - manager read" on public.gamification_calibration;
create policy "gamification_calibration - manager read" on public.gamification_calibration for SELECT to public using (((company_id = auth_company_id()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = gamification_calibration.company_id) AND ((p.role = ANY (admin_roles())) OR (p.sales_coach_role = 'admin'::text)))))));

drop policy if exists "growth_record - select own or manager" on public.growth_record;
create policy "growth_record - select own or manager" on public.growth_record for SELECT to public using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = growth_record.company_id) AND ((growth_record.agent_id = p.id) OR (p.role = ANY (admin_roles())) OR (p.sales_coach_role = 'admin'::text))))));

drop policy if exists "kpi_snapshot - select own or manager" on public.kpi_snapshot;
create policy "kpi_snapshot - select own or manager" on public.kpi_snapshot for SELECT to public using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = kpi_snapshot.company_id) AND ((kpi_snapshot.agent_id = p.id) OR (p.role = ANY (admin_roles())) OR (p.sales_coach_role = 'admin'::text))))));

drop policy if exists "pitch_analyses - select" on public.pitch_analyses;
create policy "pitch_analyses - select" on public.pitch_analyses for SELECT to public using ((EXISTS ( SELECT 1
   FROM pitches pi
  WHERE ((pi.id = pitch_analyses.pitch_id) AND ((pi.rep_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM profiles p
          WHERE ((p.id = auth.uid()) AND (p.company_id = pi.company_id) AND ((p.role = ANY (admin_roles())) OR (p.sales_coach_role = 'admin'::text))))))))));

drop policy if exists "pitch_transcripts - select" on public.pitch_transcripts;
create policy "pitch_transcripts - select" on public.pitch_transcripts for SELECT to public using ((EXISTS ( SELECT 1
   FROM pitches pi
  WHERE ((pi.id = pitch_transcripts.pitch_id) AND ((pi.rep_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM profiles p
          WHERE ((p.id = auth.uid()) AND (p.company_id = pi.company_id) AND ((p.role = ANY (admin_roles())) OR (p.sales_coach_role = 'admin'::text))))))))));

drop policy if exists "pitches - select" on public.pitches;
create policy "pitches - select" on public.pitches for SELECT to public using (((rep_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = pitches.company_id) AND ((p.role = ANY (admin_roles())) OR (p.sales_coach_role = 'admin'::text)))))));

drop policy if exists profile_departments_delete_admin on public.profile_departments;
create policy profile_departments_delete_admin on public.profile_departments for DELETE to public using ((EXISTS ( SELECT 1
   FROM (profiles me
     JOIN profiles target ON ((target.id = profile_departments.profile_id)))
  WHERE ((me.id = auth.uid()) AND (me.company_id = target.company_id) AND (me.role = ANY (admin_roles()))))));

drop policy if exists profile_departments_insert_admin on public.profile_departments;
create policy profile_departments_insert_admin on public.profile_departments for INSERT to public with check ((EXISTS ( SELECT 1
   FROM (profiles me
     JOIN profiles target ON ((target.id = profile_departments.profile_id)))
  WHERE ((me.id = auth.uid()) AND (me.company_id = target.company_id) AND (me.role = ANY (admin_roles()))))));

drop policy if exists "rep_daily_sales_goal - manager insert" on public.rep_daily_sales_goal;
create policy "rep_daily_sales_goal - manager insert" on public.rep_daily_sales_goal for INSERT to public with check (((company_id = auth_company_id()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = rep_daily_sales_goal.company_id) AND ((p.role = ANY (admin_roles())) OR (p.sales_coach_role = 'admin'::text))))) AND (EXISTS ( SELECT 1
   FROM profiles r
  WHERE ((r.id = rep_daily_sales_goal.rep_id) AND (r.company_id = auth_company_id()))))));

drop policy if exists "rep_daily_sales_goal - manager update" on public.rep_daily_sales_goal;
create policy "rep_daily_sales_goal - manager update" on public.rep_daily_sales_goal for UPDATE to public using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = rep_daily_sales_goal.company_id) AND ((p.role = ANY (admin_roles())) OR (p.sales_coach_role = 'admin'::text)))))) with check (((company_id = auth_company_id()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = rep_daily_sales_goal.company_id) AND ((p.role = ANY (admin_roles())) OR (p.sales_coach_role = 'admin'::text))))) AND (EXISTS ( SELECT 1
   FROM profiles r
  WHERE ((r.id = rep_daily_sales_goal.rep_id) AND (r.company_id = auth_company_id()))))));

drop policy if exists "rep_daily_sales_goal - select" on public.rep_daily_sales_goal;
create policy "rep_daily_sales_goal - select" on public.rep_daily_sales_goal for SELECT to public using (((rep_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = rep_daily_sales_goal.company_id) AND ((p.role = ANY (admin_roles())) OR (p.sales_coach_role = 'admin'::text)))))));

drop policy if exists "rep_day_target - select" on public.rep_day_target;
create policy "rep_day_target - select" on public.rep_day_target for SELECT to public using (((rep_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = rep_day_target.company_id) AND ((p.role = ANY (admin_roles())) OR (p.sales_coach_role = 'admin'::text)))))));

drop policy if exists "rep_pattern_summaries - select" on public.rep_pattern_summaries;
create policy "rep_pattern_summaries - select" on public.rep_pattern_summaries for SELECT to public using (((rep_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = rep_pattern_summaries.company_id) AND ((p.role = ANY (admin_roles())) OR (p.sales_coach_role = 'admin'::text)))))));

drop policy if exists "sales_coach_corpus - insert" on public.sales_coach_corpus_versions;
create policy "sales_coach_corpus - insert" on public.sales_coach_corpus_versions for INSERT to public with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = sales_coach_corpus_versions.company_id) AND ((p.role = ANY (admin_roles())) OR (p.sales_coach_role = 'admin'::text))))));

drop policy if exists "support_ai_co_pilot_edits - insert" on public.support_ai_co_pilot_edits;
create policy "support_ai_co_pilot_edits - insert" on public.support_ai_co_pilot_edits for INSERT to public with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = support_ai_co_pilot_edits.company_id) AND (p.is_support_agent OR (p.role = ANY (admin_roles())))))));

drop policy if exists "support_canned_responses - mutate" on public.support_canned_responses;
create policy "support_canned_responses - mutate" on public.support_canned_responses for ALL to public using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = support_canned_responses.company_id) AND (p.is_support_agent OR (p.role = ANY (admin_roles())))))));

drop policy if exists "support_canned_responses - select" on public.support_canned_responses;
create policy "support_canned_responses - select" on public.support_canned_responses for SELECT to public using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = support_canned_responses.company_id) AND (p.is_support_agent OR (p.role = ANY (admin_roles())))))));

drop policy if exists "support_conversation_tags - mutate" on public.support_conversation_tags;
create policy "support_conversation_tags - mutate" on public.support_conversation_tags for ALL to public using ((EXISTS ( SELECT 1
   FROM (support_conversations c
     JOIN profiles p ON ((p.id = auth.uid())))
  WHERE ((c.id = support_conversation_tags.conversation_id) AND (c.company_id = p.company_id) AND (p.is_support_agent OR (p.role = ANY (admin_roles())))))));

drop policy if exists "support_conversations - update" on public.support_conversations;
create policy "support_conversations - update" on public.support_conversations for UPDATE to public using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = support_conversations.company_id) AND (p.is_support_agent OR (p.role = ANY (admin_roles()))))))) with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = support_conversations.company_id) AND (p.is_support_agent OR (p.role = ANY (admin_roles())))))));

drop policy if exists "support_customers - insert" on public.support_customers;
create policy "support_customers - insert" on public.support_customers for INSERT to public with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = support_customers.company_id) AND (p.is_support_agent OR (p.role = ANY (admin_roles())))))));

drop policy if exists "support_customers - update" on public.support_customers;
create policy "support_customers - update" on public.support_customers for UPDATE to public using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = support_customers.company_id) AND (p.is_support_agent OR (p.role = ANY (admin_roles()))))))) with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = support_customers.company_id) AND (p.is_support_agent OR (p.role = ANY (admin_roles())))))));

drop policy if exists "support_durability_checks - update" on public.support_durability_checks;
create policy "support_durability_checks - update" on public.support_durability_checks for UPDATE to public using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = support_durability_checks.company_id) AND (p.is_support_agent OR (p.role = ANY (admin_roles()))))))) with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = support_durability_checks.company_id) AND (p.is_support_agent OR (p.role = ANY (admin_roles())))))));

drop policy if exists "support_messages - insert" on public.support_messages;
create policy "support_messages - insert" on public.support_messages for INSERT to public with check ((((author_id = auth.uid()) OR (author_id IS NULL)) AND (EXISTS ( SELECT 1
   FROM (support_conversations c
     JOIN profiles p ON ((p.id = auth.uid())))
  WHERE ((c.id = support_messages.conversation_id) AND (c.company_id = p.company_id) AND (p.is_support_agent OR (p.role = ANY (admin_roles()))))))));

drop policy if exists "support_resolutions - insert" on public.support_resolutions;
create policy "support_resolutions - insert" on public.support_resolutions for INSERT to public with check ((((captured_by = auth.uid()) OR (captured_by IS NULL)) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = support_resolutions.company_id) AND (p.is_support_agent OR (p.role = ANY (admin_roles()))))))));

drop policy if exists "support_tags - mutate" on public.support_tags;
create policy "support_tags - mutate" on public.support_tags for ALL to public using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = support_tags.company_id) AND (p.is_support_agent OR (p.role = ANY (admin_roles())))))));

