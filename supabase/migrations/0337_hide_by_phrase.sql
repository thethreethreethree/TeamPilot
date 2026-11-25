-- 0337 — a company admin's phrases hide a call (2026-11-25; Gong ledger F33.8; founder pickers "Hide by phrase, admin
-- rules" and "Real hide, in stages"). STAGE 1.
--
-- An admin lists phrases (e.g. "this is a personal call"). When a call's transcript contains one, the call is HIDDEN:
-- only the call's rep and company admins can read it. Hidden here means the DATABASE refuses it: a restrictive SELECT
-- policy on the call and its content tables — coaching_sessions, coaching_transcript_segments, remote_call_briefs,
-- pitch_scores, call_notes, remote_followup_drafts, session_follow_through, snippets — lets a row through only when
-- rss_call_hidden_from_me(session) is false. Server routes that read with the service role ask the same function
-- (rss_call_hidden_for). Stage 2 covers the remaining derived tables.
--
-- Nothing is deleted (append-only): a hide is a row naming the phrase that matched (the admin's words, never the
-- customer's); an admin can unhide (call_unhides) and that sticks (one hide per call and phrase). Retiring a phrase
-- stops new hides; existing ones stay until unhidden. Re-runnable.

create table if not exists public.hide_phrases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  phrase text not null check (length(btrim(phrase)) between 3 and 120),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create table if not exists public.hide_phrase_retirements (
  id bigint generated always as identity primary key,
  phrase_id uuid not null references public.hide_phrases(id),
  company_id uuid not null references public.companies(id),
  retired_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint hide_phrase_retirements_once unique (phrase_id)
);
create table if not exists public.call_hides (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  session_id uuid not null references public.coaching_sessions(id),
  phrase_id uuid not null references public.hide_phrases(id),
  phrase text not null,
  created_at timestamptz not null default now(),
  constraint call_hides_once unique (session_id, phrase_id)
);
create index if not exists call_hides_session_idx on public.call_hides (session_id);
create table if not exists public.call_unhides (
  id bigint generated always as identity primary key,
  hide_id uuid not null references public.call_hides(id),
  company_id uuid not null references public.companies(id),
  unhidden_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint call_unhides_once unique (hide_id)
);

do $$
declare t text;
begin
  foreach t in array array['hide_phrases', 'hide_phrase_retirements', 'call_hides', 'call_unhides'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists rss_%s_select on public.%I', t, t);
    -- The company reads them: the call page says why a call is hidden; the phrases are the admin's own words.
    execute format('create policy rss_%s_select on public.%I for select to authenticated using (company_id = auth_company_id())', t, t);
    execute format('drop policy if exists mfa_required on public.%I', t);
    execute format('create policy mfa_required on public.%I as restrictive for all to authenticated using ((select public.rss_mfa_ok())) with check ((select public.rss_mfa_ok()))', t);
    execute format('create or replace rule %s_no_update as on update to public.%I do instead nothing', t, t);
    execute format('create or replace rule %s_no_delete as on delete to public.%I do instead nothing', t, t);
  end loop;
end $$;

-- Is this call hidden (an active hide), and is `viewer` NOT allowed to see it anyway (its rep, or a company admin)?
create or replace function public.rss_call_hidden_for(p_session uuid, viewer uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
           select 1 from call_hides h
           where h.session_id = p_session
             and not exists (select 1 from call_unhides u where u.hide_id = h.id)
         )
     and not exists (select 1 from coaching_sessions s where s.id = p_session and s.agent_id = viewer)
     and not rss_is_company_admin(viewer)
$$;
create or replace function public.rss_call_hidden_from_me(p_session uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select p_session is not null and rss_call_hidden_for(p_session, auth.uid())
$$;
revoke all on function public.rss_call_hidden_for(uuid, uuid) from public, anon, authenticated;
grant execute on function public.rss_call_hidden_for(uuid, uuid) to service_role;
revoke all on function public.rss_call_hidden_from_me(uuid) from public, anon;
grant execute on function public.rss_call_hidden_from_me(uuid) to authenticated, service_role;

-- The hide itself: restrictive, so it narrows every existing read rule and widens none.
drop policy if exists rss_not_hidden on public.coaching_sessions;
create policy rss_not_hidden on public.coaching_sessions as restrictive for select to authenticated
  using (not public.rss_call_hidden_from_me(id));
do $$
declare t text;
begin
  foreach t in array array['coaching_transcript_segments', 'remote_call_briefs', 'pitch_scores', 'call_notes', 'remote_followup_drafts', 'session_follow_through', 'snippets'] loop
    execute format('drop policy if exists rss_not_hidden on public.%I', t);
    execute format('create policy rss_not_hidden on public.%I as restrictive for select to authenticated using (not public.rss_call_hidden_from_me(session_id))', t);
  end loop;
end $$;
