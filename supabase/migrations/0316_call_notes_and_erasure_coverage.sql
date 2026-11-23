-- 0316 — call notes, and legal erasure that reaches every table holding a customer's words (2026-11-23).
--
-- 1. CALL NOTES (gong.io capture F9.20 "Take notes during a call", graded LACK; founder picker 2026-11-23: readable by
--    the call's rep and their managers). The call's rep writes notes during or after a phone/video call, each stamped
--    with the moment in the call (at_ms) so it can play from there. Append-only (§3.1): a correction is a new note.
--    Readable by whoever can open the call (coaching_sessions RLS: the rep, their managers in the tree).
--
-- 2. ERASURE COVERAGE (CLAUDE.md §3.1.1). rss_erase_sessions (0285) deletes a customer's words from the tables that
--    existed on 2026-11-20. Macro Mode (0303) then added tables holding text derived from the call — call briefs (key
--    points, next steps), checklist reviews (kept items), follow-up drafts (email/text bodies) — and the prospect's
--    name and organization, which identify the customer as the client label does. Erasing a customer left all of that
--    in place. Found while adding call notes (2026-11-23). This migration:
--      · makes those tables' append-only rules erasure-aware, exactly as 0285 did for its tables (a delete during an
--        erasure must not be silently swallowed by "do instead nothing");
--      · redefines rss_erase_sessions = 0285's body unchanged, plus: delete call notes, call briefs and their checklist
--        reviews, follow-up drafts; blank the titles of Tasks the checklist or the prospect's to-dos created; replace
--        the prospect's name and organization with "(erased on request)"; blank the rep's feedback-request message;
--        scrub the client name and quoted excerpts from the call's notifications.
--    What stays, as §3.1.1(3) requires: the call, its rep, scores and points; the prospect's stage, amount and dates.
--    A guard test (erasureCoverage.test.ts) fails if a later table keyed to a call holds text and is not erased here.
-- Re-runnable.

-- ── 1. call notes ────────────────────────────────────────────────────────────────────────────
create table if not exists public.call_notes (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id),
  session_id uuid not null references public.coaching_sessions(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  at_ms integer check (at_ms is null or at_ms >= 0),
  body text not null check (length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists call_notes_session_idx on public.call_notes (session_id, id);
alter table public.call_notes enable row level security;
drop policy if exists call_notes_select on public.call_notes;
create policy call_notes_select on public.call_notes for select to authenticated
  using (company_id = auth_company_id() and exists (select 1 from coaching_sessions s where s.id = call_notes.session_id));
-- Only the call's own rep writes notes on it.
drop policy if exists call_notes_insert on public.call_notes;
create policy call_notes_insert on public.call_notes for insert to authenticated
  with check (company_id = auth_company_id() and author_id = auth.uid()
              and exists (select 1 from coaching_sessions s where s.id = call_notes.session_id and s.agent_id = auth.uid()
                                                             and s.company_id = auth_company_id()));
drop policy if exists mfa_required on public.call_notes;
create policy mfa_required on public.call_notes as restrictive for all to authenticated
  using ((select public.rss_mfa_ok())) with check ((select public.rss_mfa_ok()));

-- ── 2a. erasure-aware append-only rules (0285's pattern) ──────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array['call_notes', 'remote_call_briefs', 'remote_checklist_reviews', 'remote_followup_drafts', 'remote_prospect_events', 'feedback_requests'] loop
    execute format(
      'create or replace rule %I as on delete to public.%I where coalesce(current_setting(''rss.erasure'', true), '''') <> ''on'' do instead nothing',
      t || '_no_delete', t);
    execute format(
      'create or replace rule %I as on update to public.%I where coalesce(current_setting(''rss.erasure'', true), '''') <> ''on'' do instead nothing',
      t || '_no_update', t);
  end loop;
end $$;

-- ── 2b. rss_erase_sessions: 0285's body, plus the Macro Mode tables and call notes ────────────
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
  delete from events where company_id = p_company and subject = any (subjects);
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
  c := c || jsonb_build_object('call_briefs', cardinality(brief_ids));
  delete from remote_followup_drafts where company_id = p_company and session_id = any (p_sessions);
  get diagnostics k = row_count; c := c || jsonb_build_object('followup_drafts', k);

  -- BLANKED, ROW KEPT: the facts (that the call happened, its rep, its outcome, its grades and points) stay.
  update coaching_sessions
     set client_label = null, territory = null, approach = null, offer = null, audio_asset_url = null
   where id = any (p_sessions) and company_id = p_company;
  update pitch_scores set transcript = null, audio_url = null where id = any (pitch_ids);
  update pitch_score_elements set evidence = null where pitch_id = any (pitch_ids) and evidence is not null;
  update pitch_score_events set evidence = null where pitch_id = any (pitch_ids) and evidence is not null;
  update pitch_score_archive
     set archived_payload = rss_scrub_keys(archived_payload, array['evidence', 'transcript', 'audio_url', 'quote'])
   where pitch_score_id = any (pitch_ids);
  update tasks set title = 'Call back (details erased on request)', description = null where id = any (task_ids);
  update events set payload = rss_scrub_keys(payload, array['title', 'description'])
   where company_id = p_company and subject = any (task_subjects);
  update signals set payload = rss_scrub_keys(payload, array['title', 'description'])
   where company_id = p_company and source = any (task_subjects);
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

  insert into erasure_completions (request_id, company_id, sessions_erased, erased_by)
  values (p_request, p_company, n_sessions, p_by);

  perform set_config('rss.erasure', '', true);
  return c || jsonb_build_object('sessions', n_sessions);
end $$;
revoke all on function public.rss_erase_sessions(uuid, uuid, uuid[], uuid) from public, anon, authenticated;
grant execute on function public.rss_erase_sessions(uuid, uuid, uuid[], uuid) to service_role;
