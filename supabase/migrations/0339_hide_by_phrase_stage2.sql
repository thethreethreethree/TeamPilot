-- 0339 — hide by phrase, stage 2 (F33.8): the rest of a hidden call's own rows.
-- 0337 hid the call, its transcript, brief, score, notes, follow-up drafts, follow-through and clips from everyone but
-- its rep and company admins. This adds the same restrictive SELECT rule to what else a person can read about the call:
--   by session_id — the after-call summary, live cues and their outcomes, tracker hits (the matched words), talk stats,
--     transcript-edit records, library items, and notices about the call (a manager's bell would otherwise link to it);
--   by pitch_id — the score's per-item grades and evidence quotes, score events, corrections, timestamped comments
--     (their revisions follow the comment, 0333) and share events. rss_pitch_hidden_from_me looks the pitch's call up
--     as definer, because under the caller's RLS a hidden pitch reads as no row (and NULL would mean 'not hidden').
-- Restrictive: narrows every existing read rule, widens none. Points (agent_point_ledger) and calibration scores are
-- not hidden: they hold no words, like the facts legal erasure keeps (§3.1.1). Feedback requests stay visible: the rep
-- chose to ask; the call page tells the manager it's hidden. Plain statements (no DO loop) so the audits can read them.

create or replace function public.rss_pitch_hidden_from_me(p_pitch uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select public.rss_call_hidden_from_me((select p.session_id from pitch_scores p where p.id = p_pitch))
$$;
revoke all on function public.rss_pitch_hidden_from_me(uuid) from public, anon;
grant execute on function public.rss_pitch_hidden_from_me(uuid) to authenticated, service_role;

drop policy if exists rss_not_hidden on public.after_pitch_summaries;
create policy rss_not_hidden on public.after_pitch_summaries as restrictive for select to authenticated
  using (not public.rss_call_hidden_from_me(session_id));
drop policy if exists rss_not_hidden on public.coaching_cues;
create policy rss_not_hidden on public.coaching_cues as restrictive for select to authenticated
  using (not public.rss_call_hidden_from_me(session_id));
drop policy if exists rss_not_hidden on public.coaching_cue_outcomes;
create policy rss_not_hidden on public.coaching_cue_outcomes as restrictive for select to authenticated
  using (not public.rss_call_hidden_from_me(session_id));
drop policy if exists rss_not_hidden on public.tracker_hits;
create policy rss_not_hidden on public.tracker_hits as restrictive for select to authenticated
  using (not public.rss_call_hidden_from_me(session_id));
drop policy if exists rss_not_hidden on public.session_interaction_stats;
create policy rss_not_hidden on public.session_interaction_stats as restrictive for select to authenticated
  using (not public.rss_call_hidden_from_me(session_id));
drop policy if exists rss_not_hidden on public.transcript_line_edits;
create policy rss_not_hidden on public.transcript_line_edits as restrictive for select to authenticated
  using (not public.rss_call_hidden_from_me(session_id));
drop policy if exists rss_not_hidden on public.library_items;
create policy rss_not_hidden on public.library_items as restrictive for select to authenticated
  using (not public.rss_call_hidden_from_me(session_id));
drop policy if exists rss_not_hidden on public.manager_notifications;
create policy rss_not_hidden on public.manager_notifications as restrictive for select to authenticated
  using (not public.rss_call_hidden_from_me(session_id));

drop policy if exists rss_not_hidden on public.pitch_score_elements;
create policy rss_not_hidden on public.pitch_score_elements as restrictive for select to authenticated
  using (not public.rss_pitch_hidden_from_me(pitch_id));
drop policy if exists rss_not_hidden on public.pitch_score_events;
create policy rss_not_hidden on public.pitch_score_events as restrictive for select to authenticated
  using (not public.rss_pitch_hidden_from_me(pitch_id));
drop policy if exists rss_not_hidden on public.pitch_score_overrides;
create policy rss_not_hidden on public.pitch_score_overrides as restrictive for select to authenticated
  using (not public.rss_pitch_hidden_from_me(pitch_id));
drop policy if exists rss_not_hidden on public.recording_comments;
create policy rss_not_hidden on public.recording_comments as restrictive for select to authenticated
  using (not public.rss_pitch_hidden_from_me(pitch_id));
drop policy if exists rss_not_hidden on public.recording_share_events;
create policy rss_not_hidden on public.recording_share_events as restrictive for select to authenticated
  using (not public.rss_pitch_hidden_from_me(pitch_id));
