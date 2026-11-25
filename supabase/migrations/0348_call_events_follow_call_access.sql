-- 0348 — a call's AI reads follow the call's own access (founder picker 2026-11-26, "Follow the call's access").
-- events' read rule (0004/0103) is the whole company, so anyone could read any call's AI summaries, breakdowns,
-- topics and dispute notes — including a rep reading a teammate's call they can't open. Calls, transcripts and scores
-- already follow the reporting tree (0273/0274) and the hide (0337–0347). This restrictive rule makes an event about a
-- call (subject 'sales_session:<call>') readable only by someone who can read that call, and one about a score
-- (subject 'pitch:<pitch>') only by someone who can read that score. Other events are untouched.
--
-- "Can read" is not re-derived here (§2.2): the subqueries read coaching_sessions / pitch_scores under the CALLER's own
-- row rules, so the tree, the rep's own access, admins and hidden calls all apply exactly as they do to the call.
-- Uncorrelated (`subject in (select …)`): Postgres builds each set once per query, not once per row.
drop policy if exists rss_call_events_follow_call on public.events;
create policy rss_call_events_follow_call on public.events as restrictive for select to authenticated
  using (
    subject is null
    or (subject not like 'sales_session:%' and subject not like 'pitch:%')
    or subject in (select 'sales_session:' || s.id::text from public.coaching_sessions s)
    or subject in (select 'pitch:' || p.id::text from public.pitch_scores p)
  );
