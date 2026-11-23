-- 0311 — editable transcripts (2026-11-23; gong.io capture M36 "Users can edit any line of a transcript"; founder
-- picker 2026-11-23: the call's rep and their managers may correct a line).
--
-- A correction never overwrites (§3.1). It writes a NEW transcript version: the current version copied line for line
-- (same columns as copy_transcript_version, 0284), with the one line's text replaced. Every reader already reads the
-- latest version through coaching_transcript_segments_current, and the earlier version — the original words — stays.
--
-- transcript_line_edits records WHO corrected WHICH line, from which version to which. It holds no text on purpose:
-- the words live only in transcript versions, which legal erasure (§3.1.1, 0285) deletes in every version, so the
-- edit log can never re-store erased words. What it keeps (a line was corrected, by whom, when) is the non-personal
-- fact §3.1.1(3) allows.
--
-- edit_transcript_line is callable by the service role only: the route decides who may edit (the call's rep, or a
-- manager whose reporting tree includes the rep) and passes the editor. Re-runnable.

create table if not exists public.transcript_line_edits (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id),
  session_id uuid not null references public.coaching_sessions(id) on delete cascade,
  seq integer not null,
  from_version integer not null,
  to_version integer not null check (to_version > from_version),
  edited_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists transcript_line_edits_session_idx on public.transcript_line_edits (session_id, seq, id);
alter table public.transcript_line_edits enable row level security;
-- Visible to whoever can see the call itself (coaching_sessions RLS: the rep, their managers in the tree).
drop policy if exists transcript_line_edits_select on public.transcript_line_edits;
create policy transcript_line_edits_select on public.transcript_line_edits for select to authenticated
  using (company_id = auth_company_id() and exists (select 1 from coaching_sessions s where s.id = transcript_line_edits.session_id));
drop policy if exists mfa_required on public.transcript_line_edits;
create policy mfa_required on public.transcript_line_edits as restrictive for all to authenticated
  using ((select public.rss_mfa_ok())) with check ((select public.rss_mfa_ok()));
create or replace rule transcript_line_edits_no_update as on update to public.transcript_line_edits do instead nothing;
-- No delete rule: erasure (0285) removes a session's rows only by the session cascade; nothing deletes edit rows.

create or replace function public.edit_transcript_line(p_session_id uuid, p_seq integer, p_text text, p_editor uuid)
  returns integer
  language plpgsql security definer set search_path = public as $$
declare
  v_cur integer;
  v_company uuid;
  v_old text;
begin
  if p_text is null or length(trim(p_text)) = 0 or length(p_text) > 4000 then
    raise exception 'transcript edit: the corrected line must have 1-4000 characters' using errcode = '22023';
  end if;
  -- Same lock as copy_transcript_version (0284), so an edit and a trim never interleave their copies.
  perform pg_advisory_xact_lock(hashtextextended(p_session_id::text, 2690));
  select company_id into v_company from coaching_sessions where id = p_session_id;
  if v_company is null then
    raise exception 'transcript edit: no such call' using errcode = 'P0002';
  end if;
  select max(version) into v_cur from coaching_transcript_segments where session_id = p_session_id;
  if v_cur is null then
    raise exception 'transcript edit: this call has no transcript' using errcode = 'P0002';
  end if;
  select text into v_old from coaching_transcript_segments where session_id = p_session_id and version = v_cur and seq = p_seq;
  if not found then
    raise exception 'transcript edit: no such line' using errcode = 'P0002';
  end if;
  if v_old = p_text then
    return v_cur; -- nothing changed: no new version, no edit row
  end if;
  insert into coaching_transcript_segments (session_id, speaker, text, seq, spoken_at, ended_at, source, speaker_cluster, version)
  select session_id, speaker, case when seq = p_seq then p_text else text end, seq, spoken_at, ended_at, source, speaker_cluster, v_cur + 1
  from coaching_transcript_segments
  where session_id = p_session_id and version = v_cur;
  insert into transcript_line_edits (company_id, session_id, seq, from_version, to_version, edited_by)
  values (v_company, p_session_id, p_seq, v_cur, v_cur + 1, p_editor);
  return v_cur + 1;
end $$;
revoke all on function public.edit_transcript_line(uuid, integer, text, uuid) from public, anon, authenticated;
grant execute on function public.edit_transcript_line(uuid, integer, text, uuid) to service_role;
