-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0295 — a trim hides its lines from the base transcript table too, and the trim test answers only for your company
-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- Found by an outside-view security review (2026-11-20, docs/tbc/2026-11-20-rss-p9/check.md):
--
--   1. 0284 filtered trimmed lines out of coaching_transcript_segments_current only. The base table
--      coaching_transcript_segments still has its own read policy (0273), so anyone allowed to read the call — the
--      rep, their manager — could query the base table directly over the API and read the cut lines, in every older
--      version too. Now the base policy carries the same predicate: a line inside an active trim is invisible to every
--      signed-in reader, current version or not. (The service role is unaffected, as for every policy; app readers go
--      through _current, which already filtered.) The AUDIO file is kept whole on purpose — a trim can be undone
--      (Gong F9.17) — and playback skips the range; removing a customer's audio for good is erasure (0285).
--   2. rss_line_trimmed is SECURITY DEFINER and executable by any signed-in user, with no company check: a user of
--      another company holding a session id could probe whether, where and when that call was trimmed. It now answers
--      false for any session outside the caller's company. With no signed-in user (service role, the AI engines) it
--      answers as before.
--
-- The policy below is 0273's, byte for byte, with one added term. Idempotent (A12).
-- ═════════════════════════════════════════════════════════════════════════════════════════════

create or replace function public.rss_line_trimmed(p_session uuid, p_start timestamptz, p_end timestamptz) returns boolean
  language sql stable security definer set search_path = public as $$
  select p_start is not null and exists (
    select 1
    from recording_trims tr
    join coaching_sessions s on s.id = tr.session_id
    where tr.session_id = p_session
      and (auth.uid() is null or s.company_id = auth_company_id())
      and not exists (select 1 from recording_trim_restores r where r.trim_id = tr.id)
      and extract(epoch from (p_start - s.started_at)) * 1000 < tr.end_ms
      and extract(epoch from (coalesce(p_end, p_start) - s.started_at)) * 1000 >= tr.start_ms
  )
$$;

drop policy if exists "coaching_transcript_segments - select" on public.coaching_transcript_segments;
create policy "coaching_transcript_segments - select" on public.coaching_transcript_segments for SELECT to public using ((EXISTS ( SELECT 1
   FROM coaching_sessions s
  WHERE ((s.id = coaching_transcript_segments.session_id) AND ((s.agent_id = auth.uid()) OR ((EXISTS ( SELECT 1
           FROM profiles p
          WHERE ((p.id = auth.uid()) AND (p.company_id = s.company_id) AND ((p.role = ANY (admin_roles())) OR (p.sales_coach_role = 'admin'::text))))) AND rss_tree_allows(s.agent_id))))))
  AND NOT public.rss_line_trimmed(coaching_transcript_segments.session_id, coaching_transcript_segments.spoken_at, coaching_transcript_segments.ended_at));
