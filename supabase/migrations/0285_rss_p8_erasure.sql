-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0285 — RSS Phase 8: erasing a customer's data (Gong F33.6), under CLAUDE.md §3.1.1 (AMD-014, ratified 2026-11-20)
-- ═════════════════════════════════════════════════════════════════════════════════════════════
--
-- §3.1.1: a company admin's filed, reviewed request may delete ONE customer's personal data and nothing else; the
-- non-personal facts stay; the erasure is itself on the record; this is the only path that may delete these rows.
--
--   1. The append-only rules on the tables erasure touches become CONDITIONAL: they still turn every delete/update
--      into nothing, unless the transaction has set rss.erasure = 'on'. Only rss_erase_sessions sets it, with
--      set_config(..., true) (transaction-local), and only the service role may call it. The rules are not dropped:
--      every other statement, from every role, behaves exactly as before. PostgREST exposes only schema public, so
--      no client can call set_config.
--   2. rss_erasure_matches — find the calls a customer is on: a phone number's digits (its last 10 when longer, so a
--      country code does not hide a match) inside any transcript line (any version) or the client label; an email in a line or the label; or the client label itself. For the admin to
--      review before anything is erased.
--   3. rss_erase_sessions — for the confirmed calls, in one transaction:
--        DELETED (the customer's words): every transcript version, live cues and cue outcomes, the retranscribe
--          cache, after-pitch summaries, the AI events about the call (subject 'sales_session:<id>': summary, dissect,
--          pivot, intel, moments), follow-through reads and their task links, tracker hits, snippets and library
--          items, and Ask Coach chats that include the call.
--        BLANKED, ROW KEPT (the facts stay): the session's client label / territory / approach / offer / audio pointer;
--          the pitch score's transcript and audio pointer and every evidence quote (grades and points stay); archived
--          scores' evidence; callback tasks' wording and the title inside their task events and signals.
--        RECORDED: an erasure_completions row (how many calls, who, when). The request row (0284) holds only a hash.
--      The audio FILES are removed by the route before this runs (storage is not in the database).
--   NOT COVERED, stated: door-knock records (addresses; no session link — F21.6 household records are not built),
--   and anything a person retyped elsewhere (a comment, a task they wrote by hand, a message).
-- Idempotent (A12).
-- ═════════════════════════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from pg_class where relname = 'erasure_requests' and relnamespace = 'public'::regnamespace) then
    raise exception 'RSS preflight: erasure_requests not found — apply 0284 first';
  end if;
end $$;

-- ── 1. conditional append-only rules ─────────────────────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array[
    'coaching_transcript_segments', 'coaching_cues', 'coaching_cue_outcomes', 'after_pitch_summaries', 'events',
    'session_follow_through', 'callback_tasks', 'tracker_hits', 'snippets', 'library_items', 'library_item_removals',
    'ask_coach_chats', 'ask_coach_turns', 'signals', 'pitch_score_archive'
  ] loop
    execute format(
      'create or replace rule %I as on delete to public.%I where coalesce(current_setting(''rss.erasure'', true), '''') <> ''on'' do instead nothing',
      t || '_no_delete', t);
    execute format(
      'create or replace rule %I as on update to public.%I where coalesce(current_setting(''rss.erasure'', true), '''') <> ''on'' do instead nothing',
      t || '_no_update', t);
  end loop;
end $$;

-- ── completion record ────────────────────────────────────────────────────────────────────────
create table if not exists public.erasure_completions (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.erasure_requests(id),
  company_id uuid not null references public.companies(id),
  sessions_erased integer not null check (sessions_erased >= 0),
  erased_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint erasure_completions_once unique (request_id)
);
alter table public.erasure_completions enable row level security;
drop policy if exists rss_ec_select on public.erasure_completions;
create policy rss_ec_select on public.erasure_completions for select to authenticated
  using (company_id = auth_company_id() and exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = any (admin_roles()) and p.status <> 'removed'));
create or replace rule erasure_completions_no_update as on update to public.erasure_completions do instead nothing;
create or replace rule erasure_completions_no_delete as on delete to public.erasure_completions do instead nothing;

-- ── helpers ──────────────────────────────────────────────────────────────────────────────────
-- Replace the value of every key named in p_keys, at any depth, with "[erased]". Pure.
create or replace function public.rss_scrub_keys(j jsonb, p_keys text[]) returns jsonb
  language plpgsql immutable set search_path = public as $$
declare
  k text;
  v jsonb;
  out jsonb;
begin
  if j is null then
    return null;
  elsif jsonb_typeof(j) = 'object' then
    out := '{}'::jsonb;
    for k, v in select * from jsonb_each(j) loop
      out := out || jsonb_build_object(k, case when k = any (p_keys) then to_jsonb('[erased]'::text) else public.rss_scrub_keys(v, p_keys) end);
    end loop;
    return out;
  elsif jsonb_typeof(j) = 'array' then
    return coalesce((select jsonb_agg(public.rss_scrub_keys(e, p_keys)) from jsonb_array_elements(j) e), '[]'::jsonb);
  end if;
  return j;
end $$;

-- ── 2. find ──────────────────────────────────────────────────────────────────────────────────
create or replace function public.rss_erasure_matches(p_company uuid, p_kind text, p_value text)
returns table (session_id uuid, started_at timestamptz, agent_id uuid, client_label text, context text, snippet text)
  language plpgsql stable security definer set search_path = public as $$
declare
  v text := trim(coalesce(p_value, ''));
  digits text := regexp_replace(coalesce(p_value, ''), '\D', '', 'g');
  -- A number given with a country code ("+1 555 010 0123") is usually SPOKEN without one, so match its national
  -- part, the last 10 digits. A shorter number is matched as given (a 7-digit local number stays 7 digits).
  needle text;
  pat text;
begin
  if p_kind = 'phone' then
    if length(digits) < 7 then
      raise exception 'RSS erasure: a phone number needs at least 7 digits';
    end if;
    needle := case when length(digits) > 10 then right(digits, 10) else digits end;
    return query
      select s.id, s.started_at, s.agent_id, s.client_label, s.context,
             (select left(t.text, 160) from coaching_transcript_segments t
               where t.session_id = s.id and regexp_replace(t.text, '\D', '', 'g') like '%' || needle || '%'
               order by t.version, t.seq limit 1)
      from coaching_sessions s
      where s.company_id = p_company
        and (regexp_replace(coalesce(s.client_label, ''), '\D', '', 'g') like '%' || needle || '%'
             or exists (select 1 from coaching_transcript_segments t
                        where t.session_id = s.id and regexp_replace(t.text, '\D', '', 'g') like '%' || needle || '%'))
      order by s.started_at desc
      limit 200;
  elsif p_kind = 'email' then
    if v !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      raise exception 'RSS erasure: that is not an email address';
    end if;
    pat := '%' || replace(replace(replace(lower(v), '\', '\\'), '%', '\%'), '_', '\_') || '%';
    return query
      select s.id, s.started_at, s.agent_id, s.client_label, s.context,
             (select left(t.text, 160) from coaching_transcript_segments t
               where t.session_id = s.id and lower(t.text) like pat order by t.version, t.seq limit 1)
      from coaching_sessions s
      where s.company_id = p_company
        and (lower(coalesce(s.client_label, '')) like pat
             or exists (select 1 from coaching_transcript_segments t where t.session_id = s.id and lower(t.text) like pat))
      order by s.started_at desc
      limit 200;
  elsif p_kind = 'client_label' then
    if length(v) < 2 then
      raise exception 'RSS erasure: give the client name as it was entered';
    end if;
    return query
      select s.id, s.started_at, s.agent_id, s.client_label, s.context, null::text
      from coaching_sessions s
      where s.company_id = p_company and lower(trim(s.client_label)) = lower(v)
      order by s.started_at desc
      limit 200;
  else
    raise exception 'RSS erasure: unknown match kind %', p_kind;
  end if;
end $$;
revoke all on function public.rss_erasure_matches(uuid, text, text) from public, anon, authenticated;
grant execute on function public.rss_erasure_matches(uuid, text, text) to service_role;

-- ── 3. erase ─────────────────────────────────────────────────────────────────────────────────
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

  insert into erasure_completions (request_id, company_id, sessions_erased, erased_by)
  values (p_request, p_company, n_sessions, p_by);

  perform set_config('rss.erasure', '', true);
  return c || jsonb_build_object('sessions', n_sessions);
end $$;
revoke all on function public.rss_erase_sessions(uuid, uuid, uuid[], uuid) from public, anon, authenticated;
grant execute on function public.rss_erase_sessions(uuid, uuid, uuid[], uuid) to service_role;
