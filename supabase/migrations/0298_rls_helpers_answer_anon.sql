-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0298 — RLS helper functions answer an anonymous caller with "no" instead of a permission error
-- ═════════════════════════════════════════════════════════════════════════════════════════════
--
-- Found by the live gate after 0271–0297 were applied to production (verify:live, 2026-11-21:
-- "ROLE anon reads 0 from POPULATED tenant tables — permission denied for function rss_tree_allows"). A read-only sweep
-- of all 188 RLS tables as anon showed 24 tables erroring the same way: 23 whose read policy calls rss_tree_allows
-- (0273) and recording_comments, whose policy calls rss_comment_base_visible (0293/0296) and rss_comment_mentions_me
-- (0293). All three were revoked from anon,
-- and Postgres does not promise to evaluate a policy's tenant test before the function call, so an anonymous read
-- raised 42501 instead of returning no rows. Nothing leaked (an error returns no data; signed-in users have the
-- grant), but a refusal must be a clean zero rows, and that is what the gate requires.
--
-- The fix: anon may execute both, and both answer false when nobody is signed in — so granting anon can tell an
-- anonymous caller nothing.
--   · rss_tree_allows: `auth.uid() is not null and (…)`. Its only app caller (src/lib/api/treeAccess.ts) asks through
--     the signed-in caller's client; rss_tree_filter calls it the same way. Service-role code bypasses RLS and does
--     not call it.
--   · rss_comment_base_visible: 0296 let a caller with no auth.uid() through so the comment route (service key) could
--     check a mention. With anon now able to call it, "no auth.uid()" no longer means service role, so the exception
--     is narrowed to auth.role() = 'service_role' (PostgREST sets the role claim from the key). Anon → false.
-- Function bodies are 0273's and 0296's verbatim apart from the stated guard. Idempotent (A12).
-- ═════════════════════════════════════════════════════════════════════════════════════════════

create or replace function public.rss_tree_allows(rep uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
     and (not rss_tree_active((select company_id from profiles where id = rep))
          or rss_can_view_rep(auth.uid(), rep))
$$;
revoke all on function public.rss_tree_allows(uuid) from public;
grant execute on function public.rss_tree_allows(uuid) to anon, authenticated, service_role;

create or replace function public.rss_comment_base_visible(viewer uuid, p_pitch uuid, p_sent boolean) returns boolean
  language sql stable security definer set search_path = public as $$
  select (coalesce(viewer = auth.uid(), false) or (auth.uid() is null and coalesce(auth.role() = 'service_role', false))) and exists (
    select 1
    from pitch_scores p
    join profiles v on v.id = viewer
    where p.id = p_pitch
      and v.company_id = p.company_id
      and v.status <> 'removed'
      and (
        (p.rep_id = viewer and p_sent)
        or (
          (v.role = any (admin_roles()) or v.sales_coach_role = 'admin')
          and (not rss_tree_active(p.company_id) or rss_can_view_rep(viewer, p.rep_id))
        )
      )
  )
$$;
revoke all on function public.rss_comment_base_visible(uuid, uuid, boolean) from public;
grant execute on function public.rss_comment_base_visible(uuid, uuid, boolean) to anon, authenticated, service_role;

-- recording_comments' policy also calls rss_comment_mentions_me (0293). Its body already answers false with nobody
-- signed in (m.user_id = auth.uid() is never true for a null uid), so it only needs the grant. Body unchanged.
revoke all on function public.rss_comment_mentions_me(uuid) from public;
grant execute on function public.rss_comment_mentions_me(uuid) to anon, authenticated, service_role;

-- coaching_transcript_segments' policy also calls rss_line_trimmed (0284, latest 0295) — found by a catalog check of
-- every policy function anon cannot execute (the production sweep showed only the first error per table). Its
-- "no auth.uid() = trusted" branch keeps trimmed lines hidden for service-role reads of the _current view; granting
-- anon unchanged would let an anonymous caller probe any session for trims — the cross-company probe 0295 closed.
-- This guard HIDES content, so it fails toward privacy the other way from the comment guard above: every caller with
-- no user stays trusted EXCEPT the anon role (PostgREST always sets the role claim for an anon-key request). A
-- claimless direct read of the view still has trimmed lines hidden; anon gets false. 0295's body otherwise verbatim.
create or replace function public.rss_line_trimmed(p_session uuid, p_start timestamptz, p_end timestamptz) returns boolean
  language sql stable security definer set search_path = public as $$
  select p_start is not null and exists (
    select 1
    from recording_trims tr
    join coaching_sessions s on s.id = tr.session_id
    where tr.session_id = p_session
      and ((auth.uid() is null and coalesce(auth.role(), '') <> 'anon') or s.company_id = auth_company_id())
      and not exists (select 1 from recording_trim_restores r where r.trim_id = tr.id)
      and extract(epoch from (p_start - s.started_at)) * 1000 < tr.end_ms
      and extract(epoch from (coalesce(p_end, p_start) - s.started_at)) * 1000 >= tr.start_ms
  )
$$;
revoke all on function public.rss_line_trimmed(uuid, timestamptz, timestamptz) from public;
grant execute on function public.rss_line_trimmed(uuid, timestamptz, timestamptz) to anon, authenticated, service_role;
