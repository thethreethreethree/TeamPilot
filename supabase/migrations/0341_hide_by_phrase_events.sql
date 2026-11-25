-- 0341 — hide by phrase (F33.8): the call's AI reads in `events` follow the hide, and every hide rule is evaluated
-- ONCE per query instead of once per row.
--
-- 1. events. A call's summaries, breakdowns, after-call reads and topics are events with subject
--    'sales_session:<call id>' — a text subject, not a call column, which is why 0337/0339 didn't reach them. events'
--    read rule is the whole company (0004/0103), so anyone in the company could still read a hidden call's AI reads.
-- 2. Speed. 0337/0339 called rss_call_hidden_from_me(session_id) per row. Measured on production inside a rolled-back
--    transaction, the same per-row shape on events took a manager's read of 1,330 rows from 125 ms to 729 ms, and it
--    grows with every table read. Here each rule asks `x not in (select <the set hidden from me>)`: an uncorrelated
--    subquery Postgres runs once per query (a hashed subplan), so the cost is per hide, not per row.
-- The verdict is still rss_call_hidden_for (0337/0340) — the sets below call it for each hidden call (§2.2). Restrictive
-- as before: narrows every read rule, widens none. NOT IN is null-unsafe, so nullable keys are guarded.

-- The calls hidden from the signed-in viewer (definer: it must see hides and pitches the viewer's own RLS refuses).
create or replace function public.rss_hidden_calls_for_me() returns setof uuid
  language sql stable security definer set search_path = public as $$
  select distinct h.session_id from call_hides h
  where not exists (select 1 from call_unhides u where u.hide_id = h.id)
    and rss_call_hidden_for(h.session_id, auth.uid())
$$;
create or replace function public.rss_hidden_pitches_for_me() returns setof uuid
  language sql stable security definer set search_path = public as $$
  select p.id from pitch_scores p where p.session_id in (select public.rss_hidden_calls_for_me())
$$;
create or replace function public.rss_hidden_subjects_for_me() returns setof text
  language sql stable security definer set search_path = public as $$
  select 'sales_session:' || s::text from public.rss_hidden_calls_for_me() s
$$;
revoke all on function public.rss_hidden_calls_for_me() from public, anon;
revoke all on function public.rss_hidden_pitches_for_me() from public, anon;
revoke all on function public.rss_hidden_subjects_for_me() from public, anon;
grant execute on function public.rss_hidden_calls_for_me() to authenticated, service_role;
grant execute on function public.rss_hidden_pitches_for_me() to authenticated, service_role;
grant execute on function public.rss_hidden_subjects_for_me() to authenticated, service_role;

drop policy if exists rss_not_hidden on public.events;
create policy rss_not_hidden on public.events as restrictive for select to authenticated
  using (subject is null or subject not in (select public.rss_hidden_subjects_for_me()));

drop policy if exists rss_not_hidden on public.coaching_sessions;
create policy rss_not_hidden on public.coaching_sessions as restrictive for select to authenticated
  using (id not in (select public.rss_hidden_calls_for_me()));

drop policy if exists rss_not_hidden on public.coaching_transcript_segments;
create policy rss_not_hidden on public.coaching_transcript_segments as restrictive for select to authenticated
  using (session_id is null or session_id not in (select public.rss_hidden_calls_for_me()));
drop policy if exists rss_not_hidden on public.remote_call_briefs;
create policy rss_not_hidden on public.remote_call_briefs as restrictive for select to authenticated
  using (session_id is null or session_id not in (select public.rss_hidden_calls_for_me()));
drop policy if exists rss_not_hidden on public.pitch_scores;
create policy rss_not_hidden on public.pitch_scores as restrictive for select to authenticated
  using (session_id is null or session_id not in (select public.rss_hidden_calls_for_me()));
drop policy if exists rss_not_hidden on public.call_notes;
create policy rss_not_hidden on public.call_notes as restrictive for select to authenticated
  using (session_id is null or session_id not in (select public.rss_hidden_calls_for_me()));
drop policy if exists rss_not_hidden on public.remote_followup_drafts;
create policy rss_not_hidden on public.remote_followup_drafts as restrictive for select to authenticated
  using (session_id is null or session_id not in (select public.rss_hidden_calls_for_me()));
drop policy if exists rss_not_hidden on public.session_follow_through;
create policy rss_not_hidden on public.session_follow_through as restrictive for select to authenticated
  using (session_id is null or session_id not in (select public.rss_hidden_calls_for_me()));
drop policy if exists rss_not_hidden on public.snippets;
create policy rss_not_hidden on public.snippets as restrictive for select to authenticated
  using (session_id is null or session_id not in (select public.rss_hidden_calls_for_me()));
drop policy if exists rss_not_hidden on public.after_pitch_summaries;
create policy rss_not_hidden on public.after_pitch_summaries as restrictive for select to authenticated
  using (session_id is null or session_id not in (select public.rss_hidden_calls_for_me()));
drop policy if exists rss_not_hidden on public.coaching_cues;
create policy rss_not_hidden on public.coaching_cues as restrictive for select to authenticated
  using (session_id is null or session_id not in (select public.rss_hidden_calls_for_me()));
drop policy if exists rss_not_hidden on public.coaching_cue_outcomes;
create policy rss_not_hidden on public.coaching_cue_outcomes as restrictive for select to authenticated
  using (session_id is null or session_id not in (select public.rss_hidden_calls_for_me()));
drop policy if exists rss_not_hidden on public.tracker_hits;
create policy rss_not_hidden on public.tracker_hits as restrictive for select to authenticated
  using (session_id is null or session_id not in (select public.rss_hidden_calls_for_me()));
drop policy if exists rss_not_hidden on public.session_interaction_stats;
create policy rss_not_hidden on public.session_interaction_stats as restrictive for select to authenticated
  using (session_id is null or session_id not in (select public.rss_hidden_calls_for_me()));
drop policy if exists rss_not_hidden on public.transcript_line_edits;
create policy rss_not_hidden on public.transcript_line_edits as restrictive for select to authenticated
  using (session_id is null or session_id not in (select public.rss_hidden_calls_for_me()));
drop policy if exists rss_not_hidden on public.library_items;
create policy rss_not_hidden on public.library_items as restrictive for select to authenticated
  using (session_id is null or session_id not in (select public.rss_hidden_calls_for_me()));
drop policy if exists rss_not_hidden on public.manager_notifications;
create policy rss_not_hidden on public.manager_notifications as restrictive for select to authenticated
  using (session_id is null or session_id not in (select public.rss_hidden_calls_for_me()));
drop policy if exists rss_not_hidden on public.pitch_score_elements;
create policy rss_not_hidden on public.pitch_score_elements as restrictive for select to authenticated
  using (pitch_id is null or pitch_id not in (select public.rss_hidden_pitches_for_me()));
drop policy if exists rss_not_hidden on public.pitch_score_events;
create policy rss_not_hidden on public.pitch_score_events as restrictive for select to authenticated
  using (pitch_id is null or pitch_id not in (select public.rss_hidden_pitches_for_me()));
drop policy if exists rss_not_hidden on public.pitch_score_overrides;
create policy rss_not_hidden on public.pitch_score_overrides as restrictive for select to authenticated
  using (pitch_id is null or pitch_id not in (select public.rss_hidden_pitches_for_me()));
drop policy if exists rss_not_hidden on public.recording_comments;
create policy rss_not_hidden on public.recording_comments as restrictive for select to authenticated
  using (pitch_id is null or pitch_id not in (select public.rss_hidden_pitches_for_me()));
drop policy if exists rss_not_hidden on public.recording_share_events;
create policy rss_not_hidden on public.recording_share_events as restrictive for select to authenticated
  using (pitch_id is null or pitch_id not in (select public.rss_hidden_pitches_for_me()));
