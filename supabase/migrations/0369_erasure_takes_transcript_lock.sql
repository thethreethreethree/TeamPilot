-- 0369 — legal erasure takes each call's transcript lock (2026-11-26; §3.1.1; review of 0368).
-- rss_erase_sessions deleted a call's transcript lines without the per-call advisory lock that writers of a new
-- transcript version take (copy_transcript_version 0284, rss_transcript_version_with_texts 0368). A vocabulary re-apply or
-- a trim committing at the same moment could add a new version after the delete, leaving the customer's words behind.
-- Now the function takes every erased call's lock first. rss_erase_sessions below: 0366's body plus that statement.

create or replace function public.rss_erase_sessions(p_company uuid, p_request uuid, p_sessions uuid[], p_by uuid)
returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  n_sessions integer;
  pitch_ids uuid[];
  ft_ids uuid[];
  task_ids uuid[];
  item_ids uuid[];
  chat_ids uuid[];
  subjects text[];
  task_subjects text[];
  brief_ids uuid[];
  prospect_ids uuid[];
  mm_task_ids uuid[];
  c jsonb := '{}'::jsonb;
  k integer;
begin
  if p_sessions is null or cardinality(p_sessions) = 0 then
    raise exception 'RSS erasure: no calls to erase';
  end if;
  if not exists (select 1 from erasure_requests r where r.id = p_request and r.company_id = p_company) then
    raise exception 'RSS erasure: request not found for this company';
  end if;
  -- 0369 (review 2026-11-26): take each call's transcript lock — the one copy_transcript_version (0284) and
  -- rss_transcript_version_with_texts (0368) take — so a re-apply or trim running at the same moment can't add a new
  -- version of the lines after they're deleted here. In a fixed order, so two erasures can't deadlock.
  perform pg_advisory_xact_lock(hashtextextended(s::text, 2690)) from (select distinct unnest(p_sessions) as s order by 1) x;
  if exists (select 1 from erasure_completions e where e.request_id = p_request) then
    raise exception 'RSS erasure: this request has already been carried out';
  end if;
  select count(*) into n_sessions from coaching_sessions s where s.id = any (p_sessions) and s.company_id = p_company;
  if n_sessions <> cardinality(p_sessions) then
    raise exception 'RSS erasure: every call must belong to the requesting company';
  end if;

  perform set_config('rss.erasure', 'on', true);

  select coalesce(array_agg(id), '{}') into pitch_ids from pitch_scores where session_id = any (p_sessions);
  select coalesce(array_agg(id), '{}') into ft_ids from session_follow_through where session_id = any (p_sessions);
  select coalesce(array_agg(task_id), '{}') into task_ids from callback_tasks where follow_through_id = any (ft_ids);
  select coalesce(array_agg(id), '{}') into item_ids from library_items where session_id = any (p_sessions);
  select coalesce(array_agg(id), '{}') into chat_ids from ask_coach_chats where company_id = p_company and session_ids && p_sessions;
  select array_agg('sales_session:' || x::text) into subjects from unnest(p_sessions) x;
  select coalesce(array_agg('task:' || x::text), '{}') into task_subjects from unnest(task_ids) x;
  -- 0316: Macro Mode and call notes.
  select coalesce(array_agg(id), '{}') into brief_ids from remote_call_briefs where company_id = p_company and session_id = any (p_sessions);
  select coalesce(array_agg(distinct prospect_id), '{}') into prospect_ids from remote_prospect_calls where company_id = p_company and session_id = any (p_sessions);
  select coalesce(array_agg(distinct x), '{}') into mm_task_ids from (
    select (item ->> 'task_id')::uuid as x
      from remote_checklist_reviews r, jsonb_array_elements(r.kept) item
     where r.brief_id = any (brief_ids) and (item ->> 'task_id') ~ '^[0-9a-f-]{36}$'
    union
    select task_id from remote_prospect_tasks where prospect_id = any (prospect_ids)
  ) t where x is not null;

  -- DELETED: the customer's words.
  delete from coaching_transcript_segments where session_id = any (p_sessions);
  get diagnostics k = row_count; c := c || jsonb_build_object('transcript_lines', k);
  delete from coaching_cue_outcomes where session_id = any (p_sessions);
  delete from coaching_cues where session_id = any (p_sessions);
  delete from coaching_retranscribe_cache where session_id = any (p_sessions);
  delete from after_pitch_summaries where session_id = any (p_sessions);
  -- 0350: by subject alone. Every subject is one of THIS company's calls (checked above), so an event about it is erased
  -- even if it was filed under another company's id (233 such rows on production, OPEN.md 2026-11-26).
  delete from events where subject = any (subjects);
  get diagnostics k = row_count; c := c || jsonb_build_object('ai_reads', k);
  delete from callback_tasks where follow_through_id = any (ft_ids);
  delete from session_follow_through where id = any (ft_ids);
  delete from tracker_hits where session_id = any (p_sessions);
  delete from library_item_removals where item_id = any (item_ids);
  delete from library_items where id = any (item_ids);
  delete from snippets where session_id = any (p_sessions);
  delete from ask_coach_turns where chat_id = any (chat_ids);
  delete from ask_coach_chats where id = any (chat_ids);
  c := c || jsonb_build_object('ask_coach_chats', cardinality(chat_ids));
  -- 0316
  delete from call_notes where company_id = p_company and session_id = any (p_sessions);
  get diagnostics k = row_count; c := c || jsonb_build_object('call_notes', k);
  delete from remote_checklist_reviews where brief_id = any (brief_ids);
  delete from remote_call_briefs where id = any (brief_ids);
  -- 0364: custom brief answers quote the customer.
  delete from custom_briefs where company_id = p_company and session_id = any (p_sessions);
  c := c || jsonb_build_object('call_briefs', cardinality(brief_ids));
  delete from remote_followup_drafts where company_id = p_company and session_id = any (p_sessions);
  get diagnostics k = row_count; c := c || jsonb_build_object('followup_drafts', k);
  -- 0343: names given to the call's speakers — a customer's name is personal data.
  delete from call_speaker_names where company_id = p_company and session_id = any (p_sessions);
  get diagnostics k = row_count; c := c || jsonb_build_object('speaker_names', k);

  -- BLANKED, ROW KEPT: the facts (that the call happened, its rep, its outcome, its grades and points) stay.
  update coaching_sessions
     set client_label = null, territory = null, approach = null, offer = null, audio_asset_url = null
   where id = any (p_sessions) and company_id = p_company;
  update pitch_scores set transcript = null, audio_url = null where id = any (pitch_ids);
  update pitch_score_elements set evidence = null where pitch_id = any (pitch_ids) and evidence is not null;
  update pitch_score_events set evidence = null where pitch_id = any (pitch_ids) and evidence is not null;
  -- 0366 (founder picker 2026-11-26, "Blank the text"): typed notes about these calls' scores can quote the customer.
  -- The words go; that a dispute or answer happened, who wrote it, when, and the score stay (the callback-task rule).
  update events set payload = rss_scrub_keys(payload, array['note'])
   where subject = any (array(select 'pitch:' || p::text from unnest(pitch_ids) p))
     and kind in ('coach.pitch_score_disputed', 'coach.pitch_score_answered');
  update pitch_score_overrides set reason = '[erased]' where pitch_id = any (pitch_ids) and reason <> '[erased]';
  update pitch_score_archive
     set archived_payload = rss_scrub_keys(archived_payload, array['evidence', 'transcript', 'audio_url', 'quote'])
   where pitch_score_id = any (pitch_ids);
  update tasks set title = 'Call back (details erased on request)', description = null where id = any (task_ids);
  update events set payload = rss_scrub_keys(payload, array['title', 'description'])
   where subject = any (task_subjects); -- 0350: task ids are this company's (from its calls), whatever the row's company
  update signals set payload = rss_scrub_keys(payload, array['title', 'description'])
   where source = any (task_subjects); -- 0351: as the task-event scrub above (0350), whatever the row's company
  c := c || jsonb_build_object('tasks_blanked', cardinality(task_ids));
  -- 0316: Tasks the call's checklist or the prospect's to-dos created; the prospect's name and organization.
  update tasks set title = 'To-do (details erased on request)', description = null where id = any (mm_task_ids);
  c := c || jsonb_build_object('prospect_tasks_blanked', cardinality(mm_task_ids));
  delete from remote_prospect_events where prospect_id = any (prospect_ids) and kind in ('name', 'organization');
  insert into remote_prospect_events (prospect_id, company_id, kind, value, actor_id)
    select p, p_company, 'name', jsonb_build_object('text', '(erased on request)'), p_by from unnest(prospect_ids) p;
  c := c || jsonb_build_object('prospects_renamed', cardinality(prospect_ids));
  -- 0316: a rep's feedback-request message about the call, and notification text that quotes it or names the client.
  update feedback_requests set message = null where company_id = p_company and session_id = any (p_sessions) and message is not null;
  get diagnostics k = row_count; c := c || jsonb_build_object('feedback_messages_blanked', k);
  update manager_notifications set payload = rss_scrub_keys(payload, array['client_label', 'excerpt'])
   where company_id = p_company and session_id = any (p_sessions);
  get diagnostics k = row_count; c := c || jsonb_build_object('notifications_scrubbed', k);
  -- 0317 (founder picker 2026-11-23, "Retire them"): practice scenarios a manager built from an erased call may describe
  -- the customer. They are immutable by design (0282); retiring is the one change their guard allows. Retired scenarios
  -- leave Training and can't be assigned; past attempts keep their scores (non-personal facts, §3.1.1(3)).
  update training_scenarios set retired_at = now()
   where company_id = p_company and source_session_id = any (p_sessions) and retired_at is null;
  get diagnostics k = row_count; c := c || jsonb_build_object('scenarios_retired', k);

  insert into erasure_completions (request_id, company_id, sessions_erased, erased_by)
  values (p_request, p_company, n_sessions, p_by);

  perform set_config('rss.erasure', '', true);
  return c || jsonb_build_object('sessions', n_sessions);
end $$;
revoke all on function public.rss_erase_sessions(uuid, uuid, uuid[], uuid) from public, anon, authenticated;
grant execute on function public.rss_erase_sessions(uuid, uuid, uuid[], uuid) to service_role;

