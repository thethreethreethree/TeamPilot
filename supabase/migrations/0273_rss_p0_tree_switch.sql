-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0273 — RSS Phase 0 step 8: managers see their own reports, once a company's reporting lines are set
-- ═════════════════════════════════════════════════════════════════════════════════════════════
--
-- Plan: docs/rss/docs/07-BUILD-ORDER.md Phase 0 step 8 ("switch existing policies to the tree, per company,
-- once that company's managers are set"). Build record: docs/tbc/2026-11-15-rss-p0.
--
-- WHEN A COMPANY SWITCHES (founder picker 2026-11-15, "Automatic once all are set")
--   rss_tree_active(company) is true when the company has at least one active Sales Coach rep
--   (sales_coach_role = 'staff') and EVERY active rep has a manager_id. Until then the company behaves
--   exactly as today. Setting the first rep's manager does not hide anyone; a new rep without a manager
--   switches the company back to today's behaviour until they are given one.
--
-- HOW THE RULE IS APPLIED — ONE TERM, NOT N COPIES (§2.2)
--   rss_tree_allows(rep) = not rss_tree_active(rep's company) or rss_can_view_rep(auth.uid(), rep).
--   Each policy below keeps its EXISTING manager condition verbatim and adds `and rss_tree_allows(<rep>)` to
--   the manager branch only. The owner branch is untouched (a rep always sees their own). Before the switch,
--   rss_tree_allows is true for everyone, so every policy is byte-for-byte today's in effect.
--   D2 (decided): company admins keep company-wide view — rss_can_view_rep includes them.
--
-- WHICH POLICIES
--   The plan named pitch_scores (0252), the coaching selects (0084, now 0265) and recording_comments (0259).
--   Switching a parent and not its children would leave a manager outside the tree reading the evidence of a
--   pitch they cannot see, so every pitch- and session-child with the same manager branch is switched too:
--   coaching_sessions, coaching_transcript_segments, coaching_cues, pitch_scores, pitch_score_elements,
--   pitch_score_events, pitch_score_overrides, patterns, pattern_events, recording_comments,
--   recording_share_events, and 0272's pitch_score_provenance / pitch_score_archive (which used the strict
--   tree rule even before a company switched — corrected here to the same rule as their pitch).
--   NOT switched yet, and listed in the build record as a named sweep: agent_baseline, agent_point_ledger,
--   growth_record, kpi_snapshot, door_knocks, door_knock_undos, gamification_calibration, rep_day_target,
--   rep_daily_sales_goal, rep_pattern_summaries, pitches / pitch_analyses / pitch_transcripts (door log).
--   Until swept they behave exactly as today (a manager sees the company), which is no wider than now.
--
-- Each recreated policy is copied from its latest definition (0265 for the coaching tables, 0252 / 0255 /
-- 0258 / 0259 / 0260 for the rest) with only the tree term added. Idempotent (A12).
-- ═════════════════════════════════════════════════════════════════════════════════════════════

-- ─── the rule ─────────────────────────────────────────────────────────────────────────────────
create or replace function public.rss_tree_active(company uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
           select 1 from profiles p
           where p.company_id = company and p.status <> 'removed' and p.sales_coach_role = 'staff'
         )
     and not exists (
           select 1 from profiles p
           where p.company_id = company and p.status <> 'removed' and p.sales_coach_role = 'staff'
             and p.manager_id is null
         )
$$;

-- Answers only for the caller (auth.uid()); used in RLS policies.
create or replace function public.rss_tree_allows(rep uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select not rss_tree_active((select company_id from profiles where id = rep))
      or rss_can_view_rep(auth.uid(), rep)
$$;

-- The same rule over a list, for routes that build a team view with the service role (they ask through the
-- caller's client, so auth.uid() is the manager asking). Returns the subset of `reps` the caller may see.
create or replace function public.rss_tree_filter(reps uuid[]) returns uuid[]
  language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(r), '{}') from unnest(reps) as r where rss_tree_allows(r)
$$;
revoke all on function public.rss_tree_filter(uuid[]) from public, anon;
grant execute on function public.rss_tree_filter(uuid[]) to authenticated, service_role;

-- rss_tree_active takes a company id: not client-callable (INVARIANT 4). The service role uses it for
-- alert fan-out (src/lib/coach/gamification/notify.ts).
revoke all on function public.rss_tree_active(uuid) from public, anon, authenticated;
grant execute on function public.rss_tree_active(uuid) to service_role;
revoke all on function public.rss_tree_allows(uuid) from public, anon;
grant execute on function public.rss_tree_allows(uuid) to authenticated, service_role;

-- ─── coaching tables (latest: 0265) ──────────────────────────────────────────────────────────
drop policy if exists "coaching_sessions - select" on public.coaching_sessions;
create policy "coaching_sessions - select" on public.coaching_sessions for SELECT to public using (((agent_id = auth.uid()) OR ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = coaching_sessions.company_id) AND ((p.role = ANY (admin_roles())) OR (p.sales_coach_role = 'admin'::text))))) AND rss_tree_allows(coaching_sessions.agent_id))));

drop policy if exists "coaching_transcript_segments - select" on public.coaching_transcript_segments;
create policy "coaching_transcript_segments - select" on public.coaching_transcript_segments for SELECT to public using ((EXISTS ( SELECT 1
   FROM coaching_sessions s
  WHERE ((s.id = coaching_transcript_segments.session_id) AND ((s.agent_id = auth.uid()) OR ((EXISTS ( SELECT 1
           FROM profiles p
          WHERE ((p.id = auth.uid()) AND (p.company_id = s.company_id) AND ((p.role = ANY (admin_roles())) OR (p.sales_coach_role = 'admin'::text))))) AND rss_tree_allows(s.agent_id)))))));

drop policy if exists "coaching_cues - select" on public.coaching_cues;
create policy "coaching_cues - select" on public.coaching_cues for SELECT to public using ((EXISTS ( SELECT 1
   FROM coaching_sessions s
  WHERE ((s.id = coaching_cues.session_id) AND ((s.agent_id = auth.uid()) OR ((EXISTS ( SELECT 1
           FROM profiles p
          WHERE ((p.id = auth.uid()) AND (p.company_id = s.company_id) AND ((p.role = ANY (admin_roles())) OR (p.sales_coach_role = 'admin'::text))))) AND rss_tree_allows(s.agent_id)))))));

-- ─── pitch score (0252) ───────────────────────────────────────────────────────────────────────
drop policy if exists "pitch_scores - select" on pitch_scores;
create policy "pitch_scores - select" on pitch_scores
  for select using (
    company_id = auth_company_id()
    and (rep_id = auth.uid() or (is_sales_coach_manager() and rss_tree_allows(rep_id)))
  );

drop policy if exists "pitch_score_elements - select" on pitch_score_elements;
create policy "pitch_score_elements - select" on pitch_score_elements
  for select using (
    company_id = auth_company_id()
    and exists (
      select 1 from pitch_scores p
      where p.id = pitch_score_elements.pitch_id
        and (p.rep_id = auth.uid() or (is_sales_coach_manager() and rss_tree_allows(p.rep_id)))
    )
  );

drop policy if exists "pitch_score_events - select" on pitch_score_events;
create policy "pitch_score_events - select" on pitch_score_events
  for select using (
    company_id = auth_company_id()
    and exists (
      select 1 from pitch_scores p
      where p.id = pitch_score_events.pitch_id
        and (p.rep_id = auth.uid() or (is_sales_coach_manager() and rss_tree_allows(p.rep_id)))
    )
  );

-- ─── overrides (0255) ─────────────────────────────────────────────────────────────────────────
drop policy if exists "pitch_score_overrides - select" on pitch_score_overrides;
create policy "pitch_score_overrides - select" on pitch_score_overrides
  for select using (
    exists (
      select 1 from pitch_scores p
      where p.id = pitch_score_overrides.pitch_id
        and p.company_id = auth_company_id()
        and (p.rep_id = auth.uid() or (is_sales_coach_manager() and rss_tree_allows(p.rep_id)))
    )
  );

-- ─── patterns (0258) ──────────────────────────────────────────────────────────────────────────
drop policy if exists "patterns - select" on patterns;
create policy "patterns - select" on patterns
  for select using (
    company_id = auth_company_id()
    and (rep_id = auth.uid() or (is_sales_coach_manager() and rss_tree_allows(rep_id)))
  );

drop policy if exists "pattern_events - select" on pattern_events;
create policy "pattern_events - select" on pattern_events
  for select using (
    company_id = auth_company_id()
    and exists (
      select 1 from patterns p
      where p.id = pattern_events.pattern_id
        and (p.rep_id = auth.uid() or (is_sales_coach_manager() and rss_tree_allows(p.rep_id)))
    )
  );

-- ─── recording comments (0259) and share consent (0260) ─────────────────────────────────────────
drop policy if exists "recording_comments - select" on recording_comments;
create policy "recording_comments - select" on recording_comments
  for select using (
    company_id = auth_company_id()
    and (
      (
        is_sales_coach_manager()
        and exists (
          select 1 from pitch_scores p
          where p.id = recording_comments.pitch_id
            and rss_tree_allows(p.rep_id)
        )
      )
      or (
        sent_to_rep
        and exists (
          select 1 from pitch_scores p
          where p.id = recording_comments.pitch_id
            and p.rep_id = auth.uid()
        )
      )
    )
  );

drop policy if exists "recording_share_events - select" on recording_share_events;
create policy "recording_share_events - select" on recording_share_events
  for select using (
    company_id = auth_company_id()
    and (
      (
        is_sales_coach_manager()
        and exists (
          select 1 from pitch_scores p
          where p.id = recording_share_events.pitch_id
            and rss_tree_allows(p.rep_id)
        )
      )
      or exists (
        select 1 from pitch_scores p
        where p.id = recording_share_events.pitch_id
          and p.rep_id = auth.uid()
      )
    )
  );

-- ─── 0272's provenance / archive: same rule as the pitch they describe ──────────────────────────
drop policy if exists rss_provenance_select on public.pitch_score_provenance;
create policy rss_provenance_select on public.pitch_score_provenance for select to authenticated
  using (company_id = auth_company_id() and (rep_id = auth.uid() or (is_sales_coach_manager() and rss_tree_allows(rep_id))));
drop policy if exists rss_archive_select on public.pitch_score_archive;
create policy rss_archive_select on public.pitch_score_archive for select to authenticated
  using (company_id = auth_company_id() and (rep_id = auth.uid() or (is_sales_coach_manager() and rss_tree_allows(rep_id))));
