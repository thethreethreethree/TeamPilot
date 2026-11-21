-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0274 — RSS Phase 0 step 8, the sweep: the rest of the rep-scoped policies follow the reporting tree
-- ═════════════════════════════════════════════════════════════════════════════════════════════
--
-- 0273 switched the pitch and session tables and named these as a sweep still owed. Same method: each policy
-- is recreated from its LATEST definition (0265_admin_roles_single_source.sql, or 0267 for door_knock_undos)
-- with one change — the manager branch gains `and rss_tree_allows(<rep>)`. The owner branch is untouched.
-- Before a company is on the tree rss_tree_allows is true for everyone, so nothing changes until then.
--
-- NOT switched, on purpose: gamification_calibration — its rows are a MANAGER's own blind grades (scorer_id),
-- read only by managers to compare themselves with the AI judge; the route that builds the pool already
-- filters the sessions offered by the tree (src/app/api/coach/gamification/calibration/route.ts).
--
-- Idempotent (A12).
-- ═════════════════════════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from pg_proc where proname = 'rss_tree_allows') then
    raise exception 'RSS preflight: rss_tree_allows() not found — apply 0273 first';
  end if;
end $$;

drop policy if exists "agent_baseline - select own or manager" on public.agent_baseline;
create policy "agent_baseline - select own or manager" on public.agent_baseline for SELECT to public using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = agent_baseline.company_id) AND ((agent_baseline.agent_id = p.id) OR (((p.role = ANY (admin_roles())) OR (p.sales_coach_role = 'admin'::text)) AND rss_tree_allows(agent_baseline.agent_id)))))));

drop policy if exists "agent_point_ledger - owner or manager read" on public.agent_point_ledger;
create policy "agent_point_ledger - owner or manager read" on public.agent_point_ledger for SELECT to public using (((company_id = auth_company_id()) AND ((agent_id = auth.uid()) OR ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = agent_point_ledger.company_id) AND ((p.role = ANY (admin_roles())) OR (p.sales_coach_role = 'admin'::text))))) AND rss_tree_allows(agent_point_ledger.agent_id)))));

drop policy if exists "growth_record - select own or manager" on public.growth_record;
create policy "growth_record - select own or manager" on public.growth_record for SELECT to public using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = growth_record.company_id) AND ((growth_record.agent_id = p.id) OR (((p.role = ANY (admin_roles())) OR (p.sales_coach_role = 'admin'::text)) AND rss_tree_allows(growth_record.agent_id)))))));

drop policy if exists "kpi_snapshot - select own or manager" on public.kpi_snapshot;
create policy "kpi_snapshot - select own or manager" on public.kpi_snapshot for SELECT to public using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = kpi_snapshot.company_id) AND ((kpi_snapshot.agent_id = p.id) OR (((p.role = ANY (admin_roles())) OR (p.sales_coach_role = 'admin'::text)) AND rss_tree_allows(kpi_snapshot.agent_id)))))));

drop policy if exists "door_knocks - select" on public.door_knocks;
create policy "door_knocks - select" on public.door_knocks for SELECT to public using (((rep_id = auth.uid()) OR ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = door_knocks.company_id) AND ((p.role = ANY (admin_roles())) OR (p.sales_coach_role = 'admin'::text))))) AND rss_tree_allows(door_knocks.rep_id))));

drop policy if exists "door_knock_undos - select" on door_knock_undos;
create policy "door_knock_undos - select" on door_knock_undos for select using (
  rep_id = auth.uid()
  or (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.company_id = door_knock_undos.company_id
        and (p.role = any (admin_roles()) or p.sales_coach_role = 'admin')
    )
    and rss_tree_allows(door_knock_undos.rep_id)
  )
);

drop policy if exists "rep_day_target - select" on public.rep_day_target;
create policy "rep_day_target - select" on public.rep_day_target for SELECT to public using (((rep_id = auth.uid()) OR ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = rep_day_target.company_id) AND ((p.role = ANY (admin_roles())) OR (p.sales_coach_role = 'admin'::text))))) AND rss_tree_allows(rep_day_target.rep_id))));

drop policy if exists "rep_daily_sales_goal - select" on public.rep_daily_sales_goal;
create policy "rep_daily_sales_goal - select" on public.rep_daily_sales_goal for SELECT to public using (((rep_id = auth.uid()) OR ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = rep_daily_sales_goal.company_id) AND ((p.role = ANY (admin_roles())) OR (p.sales_coach_role = 'admin'::text))))) AND rss_tree_allows(rep_daily_sales_goal.rep_id))));

drop policy if exists "rep_pattern_summaries - select" on public.rep_pattern_summaries;
create policy "rep_pattern_summaries - select" on public.rep_pattern_summaries for SELECT to public using (((rep_id = auth.uid()) OR ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = rep_pattern_summaries.company_id) AND ((p.role = ANY (admin_roles())) OR (p.sales_coach_role = 'admin'::text))))) AND rss_tree_allows(rep_pattern_summaries.rep_id))));

drop policy if exists "pitches - select" on public.pitches;
create policy "pitches - select" on public.pitches for SELECT to public using (((rep_id = auth.uid()) OR ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = pitches.company_id) AND ((p.role = ANY (admin_roles())) OR (p.sales_coach_role = 'admin'::text))))) AND rss_tree_allows(pitches.rep_id))));

drop policy if exists "pitch_analyses - select" on public.pitch_analyses;
create policy "pitch_analyses - select" on public.pitch_analyses for SELECT to public using ((EXISTS ( SELECT 1
   FROM pitches pi
  WHERE ((pi.id = pitch_analyses.pitch_id) AND ((pi.rep_id = auth.uid()) OR ((EXISTS ( SELECT 1
           FROM profiles p
          WHERE ((p.id = auth.uid()) AND (p.company_id = pi.company_id) AND ((p.role = ANY (admin_roles())) OR (p.sales_coach_role = 'admin'::text))))) AND rss_tree_allows(pi.rep_id)))))));

drop policy if exists "pitch_transcripts - select" on public.pitch_transcripts;
create policy "pitch_transcripts - select" on public.pitch_transcripts for SELECT to public using ((EXISTS ( SELECT 1
   FROM pitches pi
  WHERE ((pi.id = pitch_transcripts.pitch_id) AND ((pi.rep_id = auth.uid()) OR ((EXISTS ( SELECT 1
           FROM profiles p
          WHERE ((p.id = auth.uid()) AND (p.company_id = pi.company_id) AND ((p.role = ANY (admin_roles())) OR (p.sales_coach_role = 'admin'::text))))) AND rss_tree_allows(pi.rep_id)))))));
