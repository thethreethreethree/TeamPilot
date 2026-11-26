-- 0377 — Engage flows (2026-11-27; docs/ELOSTATE-ENGAGE-PLATFORM-BUILD-PLAN Phase E1; Gong M24 flows, M25 call outcomes,
-- F26.3 to-dos). Re-runnable.
--
--   · engage_flows — ordered steps (email / call / task, each with a delay; engage/flows.ts checkSteps). A company flow
--     (an admin or Sales Coach manager makes it) or a person's own. Never edited; retired once (a change is a new flow),
--     so an enrolment always names the steps it ran.
--   · engage_enrolments — one contact on one deal going through one flow, once (unique flow × contact). Seen and made
--     by whoever can see the deal (prospects' RLS + the tree); its rep is the deal's rep.
--   · engage_activities — every action on an enrolment, append-only: a step done (with a call outcome and a note),
--     skipped, paused, resumed, removed, replied, meeting booked, opted out. The enrolment's state and step are the
--     replay of these rows (flows.ts applyAction), so they're never stored twice.
-- Email is sent by the rep from their own mail app (plan E1); nothing here sends anything.
-- §3.1.1: a step note can quote the customer. Erasure blanks it (rss_erase_sessions and rss_erase_prospects: 0374's
-- bodies plus that step; rss_erase_contacts: 0370's body plus that step); its rules yield only to erasure (0285).

-- Contacts gain an email address and a phone number (an email step needs somewhere to send, a call step a number).
-- Personal data: erasure deletes them with the name and title, and searches them (rss_erasure_contact_matches below).
alter table public.contact_events drop constraint if exists contact_events_kind_check;
alter table public.contact_events add constraint contact_events_kind_check check (kind in ('name', 'title', 'account', 'email', 'phone'));
alter table public.contact_events drop constraint if exists contact_events_email;
alter table public.contact_events add constraint contact_events_email check (kind <> 'email' or jsonb_typeof(value -> 'text') = 'null'
  or (jsonb_typeof(value -> 'text') = 'string' and length(value ->> 'text') <= 254 and (value ->> 'text') ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'));
alter table public.contact_events drop constraint if exists contact_events_phone;
alter table public.contact_events add constraint contact_events_phone check (kind <> 'phone' or jsonb_typeof(value -> 'text') = 'null'
  or (jsonb_typeof(value -> 'text') = 'string' and (value ->> 'text') ~ '^\+?[0-9 ().-]{6,30}$'));

-- 0370's view, column for column, plus email and phone at the end.
create or replace view public.contacts_current with (security_invoker = true) as
select c.id, c.company_id, c.created_by, c.created_at,
       (select e.value ->> 'text' from contact_events e where e.contact_id = c.id and e.kind = 'name' order by e.id desc limit 1) as name,
       (select e.value ->> 'text' from contact_events e where e.contact_id = c.id and e.kind = 'title' order by e.id desc limit 1) as title,
       (select nullif(e.value ->> 'account_id', '')::uuid from contact_events e where e.contact_id = c.id and e.kind = 'account' order by e.id desc limit 1) as account_id,
       (select e.value ->> 'text' from contact_events e where e.contact_id = c.id and e.kind = 'email' order by e.id desc limit 1) as email,
       (select e.value ->> 'text' from contact_events e where e.contact_id = c.id and e.kind = 'phone' order by e.id desc limit 1) as phone
from contacts c;
grant select on public.contacts_current to authenticated, service_role;

-- 0370's match function, now also matching a contact's email address and phone number.
create or replace function public.rss_erasure_contact_matches(p_company uuid, p_kind text, p_value text)
returns table (entity text, id uuid, name text, detail text)
  language plpgsql stable security definer set search_path = public as $$
declare
  pat text := public.rss_erasure_text_pattern(p_kind, p_value);
begin
  return query
    (select 'contact'::text, c.id, c.name, c.title
       from contacts_current c
      where c.company_id = p_company
        and (coalesce(c.name, '') ~* pat or coalesce(c.title, '') ~* pat or coalesce(c.email, '') ~* pat or coalesce(c.phone, '') ~* pat)
      order by c.created_at desc limit 200)
    union all
    (select 'account'::text, a.id, a.name, null::text
       from accounts_current a
      where a.company_id = p_company and coalesce(a.name, '') ~* pat
      order by a.created_at desc limit 200);
end $$;
revoke all on function public.rss_erasure_contact_matches(uuid, text, text) from public, anon, authenticated;
grant execute on function public.rss_erasure_contact_matches(uuid, text, text) to service_role;

create or replace function public.rss_valid_flow_steps(p jsonb) returns boolean
  language sql immutable as $$
  select jsonb_typeof(p) = 'array'
     and jsonb_array_length(p) between 1 and 15
     and not exists (
       select 1 from jsonb_array_elements(p) s
        where jsonb_typeof(s) <> 'object'
           or coalesce(s ->> 'kind', '') not in ('email', 'call', 'task')
           or length(btrim(coalesce(s ->> 'title', ''))) not between 1 and 120
           or length(coalesce(s ->> 'body', '')) > 4000
           or jsonb_typeof(s -> 'delay') <> 'object'
           or coalesce(s -> 'delay' ->> 'unit', '') not in ('hours', 'business_days')
           or coalesce(s -> 'delay' ->> 'amount', '') !~ '^[0-9]+$'
           or (s -> 'delay' ->> 'amount')::int > case when s -> 'delay' ->> 'unit' = 'hours' then 720 else 30 end)
$$;

create table if not exists public.engage_flows (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  owner_id uuid not null references public.profiles(id),
  name text not null check (length(btrim(name)) between 1 and 80),
  is_company boolean not null default false,
  steps jsonb not null check (public.rss_valid_flow_steps(steps)),
  retired_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists engage_flows_company_idx on public.engage_flows (company_id, created_at desc);

create table if not exists public.engage_enrolments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  flow_id uuid not null references public.engage_flows(id),
  prospect_id uuid not null references public.remote_prospects(id),
  contact_id uuid not null references public.contacts(id),
  rep_id uuid not null references public.profiles(id),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint engage_enrolments_once unique (flow_id, contact_id)
);
create index if not exists engage_enrolments_rep_idx on public.engage_enrolments (company_id, rep_id);
create index if not exists engage_enrolments_prospect_idx on public.engage_enrolments (prospect_id);
create index if not exists engage_enrolments_contact_idx on public.engage_enrolments (contact_id);

create table if not exists public.engage_activities (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id),
  enrolment_id uuid not null references public.engage_enrolments(id),
  step_index integer not null check (step_index between 0 and 15),
  action text not null check (action in ('complete_step', 'skip_step', 'pause', 'resume', 'remove', 'replied', 'meeting_booked', 'opted_out')),
  outcome text check (outcome is null or outcome ~ '^[a-z_]{1,40}$'),
  note text check (note is null or length(note) <= 1000),
  actor_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists engage_activities_idx on public.engage_activities (enrolment_id, id);

-- A flow is never edited; retiring it is the one change (the brief template's rule, 0364).
create or replace function public.rss_guard_flow_update() returns trigger
  language plpgsql set search_path = public as $$
begin
  if (to_jsonb(new) - 'retired_at') is distinct from (to_jsonb(old) - 'retired_at') or old.retired_at is not null then
    raise exception 'a flow never changes — retire it and make a new one';
  end if;
  return new;
end $$;
drop trigger if exists rss_guard_flow_update on public.engage_flows;
create trigger rss_guard_flow_update before update on public.engage_flows for each row execute function public.rss_guard_flow_update();
create or replace rule engage_flows_no_delete as on delete to public.engage_flows do instead nothing;

-- An enrolment's rep is its deal's rep, and its flow, deal and contact are all in one company.
create or replace function public.rss_enrolment_consistent() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from remote_prospects p where p.id = new.prospect_id and p.company_id = new.company_id and p.rep_id = new.rep_id)
     or not exists (select 1 from contacts c where c.id = new.contact_id and c.company_id = new.company_id)
     or not exists (select 1 from engage_flows f where f.id = new.flow_id and f.company_id = new.company_id and f.retired_at is null) then
    raise exception 'enrolment must be the deal''s rep, a live flow and a contact of the same company';
  end if;
  return new;
end $$;
drop trigger if exists rss_enrolment_consistent on public.engage_enrolments;
create trigger rss_enrolment_consistent before insert on public.engage_enrolments for each row execute function public.rss_enrolment_consistent();

alter table public.engage_flows enable row level security;
alter table public.engage_enrolments enable row level security;
alter table public.engage_activities enable row level security;

drop policy if exists engage_flows_select on public.engage_flows;
create policy engage_flows_select on public.engage_flows for select to authenticated
  using (company_id = auth_company_id() and (is_company or owner_id = auth.uid()));
drop policy if exists engage_flows_insert on public.engage_flows;
create policy engage_flows_insert on public.engage_flows for insert to authenticated
  with check (company_id = auth_company_id() and owner_id = auth.uid() and (not is_company or is_sales_coach_manager()));
drop policy if exists engage_flows_update on public.engage_flows;
create policy engage_flows_update on public.engage_flows for update to authenticated
  using (company_id = auth_company_id() and (owner_id = auth.uid() or (is_company and is_sales_coach_manager())))
  with check (company_id = auth_company_id());

drop policy if exists engage_enrolments_select on public.engage_enrolments;
create policy engage_enrolments_select on public.engage_enrolments for select to authenticated
  using (company_id = auth_company_id() and exists (select 1 from remote_prospects p where p.id = engage_enrolments.prospect_id));
drop policy if exists engage_enrolments_insert on public.engage_enrolments;
create policy engage_enrolments_insert on public.engage_enrolments for insert to authenticated
  with check (company_id = auth_company_id() and created_by = auth.uid()
              and exists (select 1 from remote_prospects p where p.id = engage_enrolments.prospect_id)
              and exists (select 1 from contacts c where c.id = engage_enrolments.contact_id)
              and exists (select 1 from engage_flows f where f.id = engage_enrolments.flow_id));

drop policy if exists engage_activities_select on public.engage_activities;
create policy engage_activities_select on public.engage_activities for select to authenticated
  using (company_id = auth_company_id() and exists (select 1 from engage_enrolments e where e.id = engage_activities.enrolment_id));
drop policy if exists engage_activities_insert on public.engage_activities;
create policy engage_activities_insert on public.engage_activities for insert to authenticated
  with check (company_id = auth_company_id() and actor_id = auth.uid()
              and exists (select 1 from engage_enrolments e where e.id = engage_activities.enrolment_id));

do $$
declare t text;
begin
  foreach t in array array['engage_flows', 'engage_enrolments', 'engage_activities'] loop
    execute format('drop policy if exists mfa_required on public.%I', t);
    execute format('create policy mfa_required on public.%I as restrictive for all to authenticated using ((select public.rss_mfa_ok())) with check ((select public.rss_mfa_ok()))', t);
  end loop;
end $$;
create or replace rule engage_enrolments_no_update as on update to public.engage_enrolments do instead nothing;
create or replace rule engage_enrolments_no_delete as on delete to public.engage_enrolments do instead nothing;
create or replace rule engage_activities_no_update as on update to public.engage_activities
  where coalesce(current_setting('rss.erasure', true), '') <> 'on' do instead nothing;
create or replace rule engage_activities_no_delete as on delete to public.engage_activities
  where coalesce(current_setting('rss.erasure', true), '') <> 'on' do instead nothing;

-- Erasure (§3.1.1). rss_erase_sessions: 0374's exact body plus the 0377 step.
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
  contact_ids uuid[];
  account_ids uuid[];
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
  -- 0370: the contacts on these calls; the accounts that exist only for the deals being renamed.
  select coalesce(array_agg(distinct contact_id), '{}') into contact_ids from call_contacts where company_id = p_company and session_id = any (p_sessions);
  select coalesce(array_agg(distinct acc), '{}') into account_ids from (
    select nullif(e.value ->> 'account_id', '')::uuid as acc
      from remote_prospect_events e
     where e.kind = 'account' and e.prospect_id = any (prospect_ids)
  ) a
  where acc is not null
    and not exists (select 1 from remote_prospect_events o
                     where o.kind = 'account' and o.value ->> 'account_id' = a.acc::text and o.prospect_id <> all (prospect_ids));

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
  -- 0370: the contacts on these calls (name and title) and the accounts only these deals were on (name).
  delete from contact_events where contact_id = any (contact_ids) and kind in ('name', 'title', 'email', 'phone');
  insert into contact_events (contact_id, company_id, kind, value, actor_id)
    select x, p_company, 'name', jsonb_build_object('text', '(erased on request)'), p_by from unnest(contact_ids) x;
  delete from account_events where account_id = any (account_ids) and kind = 'name';
  insert into account_events (account_id, company_id, kind, value, actor_id)
    select x, p_company, 'name', jsonb_build_object('text', '(erased on request)'), p_by from unnest(account_ids) x;
  c := c || jsonb_build_object('contacts_renamed', cardinality(contact_ids), 'accounts_renamed', cardinality(account_ids));
  -- 0373: a playbook note or the AI reviewer's read on these deals can quote the customer. The words go; that a note
  -- existed, its element, who and when, stay.
  update deal_element_notes set note = case when note is null then null else '[erased]' end,
         ai = case when ai is null then null else '{"answer": "[erased]", "cites": []}'::jsonb end
   where prospect_id = any (prospect_ids) and ((note is not null and note <> '[erased]') or (ai is not null and ai ->> 'answer' <> '[erased]'));
  get diagnostics k = row_count; c := c || jsonb_build_object('deal_notes_blanked', k);
  -- 0374: a deal brief quotes and summarises the customer's words: deleted for these deals.
  delete from deal_briefs where prospect_id = any (prospect_ids);
  get diagnostics k = row_count; c := c || jsonb_build_object('deal_briefs', k);
  -- 0377: notes on Engage steps for these deals can quote the customer: blanked, the rows kept.
  update engage_activities set note = '[erased]'
   where note is not null and note <> '[erased]'
     and enrolment_id in (select id from engage_enrolments where prospect_id = any (prospect_ids));
  get diagnostics k = row_count; c := c || jsonb_build_object('engage_notes_blanked', k);
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

-- rss_erase_prospects: 0374's exact body plus the 0377 step.
create or replace function public.rss_erase_prospects(p_company uuid, p_request uuid, p_prospects uuid[], p_kind text, p_value text, p_by uuid, p_complete boolean)
returns integer
  language plpgsql security definer set search_path = public as $$
declare
  pat text := public.rss_erasure_text_pattern(p_kind, p_value);
  ids uuid[];
  task_ids uuid[];
begin
  if not exists (select 1 from erasure_requests q where q.id = p_request and q.company_id = p_company) then
    raise exception 'RSS erasure: request not found for this company';
  end if;
  if exists (select 1 from erasure_completions e where e.request_id = p_request) then
    raise exception 'RSS erasure: this request has already been carried out';
  end if;
  -- Only prospects that still match: an id the search did not return is never touched.
  select coalesce(array_agg(p.id), '{}') into ids
    from remote_prospects_current p
   where p.company_id = p_company and p.id = any (coalesce(p_prospects, '{}'))
     and (coalesce(p.name, '') ~* pat or coalesce(p.organization, '') ~* pat);
  select coalesce(array_agg(t.task_id), '{}') into task_ids from remote_prospect_tasks t where t.prospect_id = any (ids);
  perform set_config('rss.erasure', 'on', true);
  update tasks set title = 'To-do (details erased on request)', description = null where id = any (task_ids);
  delete from remote_prospect_events where prospect_id = any (ids) and kind in ('name', 'organization');
  insert into remote_prospect_events (prospect_id, company_id, kind, value, actor_id)
    select p, p_company, 'name', jsonb_build_object('text', '(erased on request)'), p_by from unnest(ids) p;
  -- 0373: the deals' playbook notes and AI reads can quote the customer: blanked, the rows kept.
  update deal_element_notes set note = case when note is null then null else '[erased]' end,
         ai = case when ai is null then null else '{"answer": "[erased]", "cites": []}'::jsonb end
   where prospect_id = any (ids) and ((note is not null and note <> '[erased]') or (ai is not null and ai ->> 'answer' <> '[erased]'));
  -- 0374: the deals' briefs.
  delete from deal_briefs where prospect_id = any (ids);
  -- 0377: notes on Engage steps for these deals can quote the customer: blanked, the rows kept.
  update engage_activities set note = '[erased]'
   where note is not null and note <> '[erased]'
     and enrolment_id in (select id from engage_enrolments where prospect_id = any (ids));
  if p_complete then
    insert into erasure_completions (request_id, company_id, sessions_erased, erased_by) values (p_request, p_company, 0, p_by);
  end if;
  perform set_config('rss.erasure', 'off', true);
  return cardinality(ids);
end $$;

revoke all on function public.rss_erase_prospects(uuid, uuid, uuid[], text, text, uuid, boolean) from public, anon, authenticated;
grant execute on function public.rss_erase_prospects(uuid, uuid, uuid[], text, text, uuid, boolean) to service_role;

-- rss_erase_contacts: 0370's exact body plus the 0377 step.
create or replace function public.rss_erase_contacts(p_company uuid, p_request uuid, p_contacts uuid[], p_accounts uuid[], p_kind text, p_value text, p_by uuid, p_complete boolean)
returns integer
  language plpgsql security definer set search_path = public as $$
declare
  pat text := public.rss_erasure_text_pattern(p_kind, p_value);
  cids uuid[];
  aids uuid[];
begin
  if not exists (select 1 from erasure_requests q where q.id = p_request and q.company_id = p_company) then
    raise exception 'RSS erasure: request not found for this company';
  end if;
  if exists (select 1 from erasure_completions e where e.request_id = p_request) then
    raise exception 'RSS erasure: this request has already been carried out';
  end if;
  select coalesce(array_agg(c.id), '{}') into cids from contacts_current c
   where c.company_id = p_company and c.id = any (coalesce(p_contacts, '{}'))
     and (coalesce(c.name, '') ~* pat or coalesce(c.title, '') ~* pat or coalesce(c.email, '') ~* pat or coalesce(c.phone, '') ~* pat);
  select coalesce(array_agg(a.id), '{}') into aids from accounts_current a
   where a.company_id = p_company and a.id = any (coalesce(p_accounts, '{}')) and coalesce(a.name, '') ~* pat;
  perform set_config('rss.erasure', 'on', true);
  delete from contact_events where contact_id = any (cids) and kind in ('name', 'title', 'email', 'phone');
  insert into contact_events (contact_id, company_id, kind, value, actor_id)
    select x, p_company, 'name', jsonb_build_object('text', '(erased on request)'), p_by from unnest(cids) x;
  -- 0377: notes on Engage steps for these contacts.
  update engage_activities set note = '[erased]'
   where note is not null and note <> '[erased]'
     and enrolment_id in (select id from engage_enrolments where contact_id = any (cids));
  delete from account_events where account_id = any (aids) and kind = 'name';
  insert into account_events (account_id, company_id, kind, value, actor_id)
    select x, p_company, 'name', jsonb_build_object('text', '(erased on request)'), p_by from unnest(aids) x;
  if p_complete then
    insert into erasure_completions (request_id, company_id, sessions_erased, erased_by) values (p_request, p_company, 0, p_by);
  end if;
  perform set_config('rss.erasure', 'off', true);
  return cardinality(cids) + cardinality(aids);
end $$;

revoke all on function public.rss_erasure_contact_matches(uuid, text, text) from public, anon, authenticated;
revoke all on function public.rss_erase_contacts(uuid, uuid, uuid[], uuid[], text, text, uuid, boolean) from public, anon, authenticated;
grant execute on function public.rss_erase_contacts(uuid, uuid, uuid[], uuid[], text, text, uuid, boolean) to service_role;
