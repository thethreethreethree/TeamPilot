-- 0328 — correct who said a transcript line (2026-11-23; OPEN.md transcript-edits "per-line speaker changes are not
-- offered").
--
-- Speaker labelling can put the customer's words under the rep, or the other way round, on single lines. 0311 lets the
-- call's rep (or their manager) correct a line's WORDS as a new transcript version; this does the same for its SPEAKER:
-- edit_transcript_speaker copies the current version with that one line's speaker changed, and records an edit row,
-- now marked with what changed (transcript_line_edits.field: 'text' for 0311's corrections, 'speaker' for these).
-- Earlier versions stay (§3.1). Same lock as 0311/0284, service role only (the route checks who may edit). Re-runnable.

alter table public.transcript_line_edits add column if not exists field text not null default 'text';
alter table public.transcript_line_edits drop constraint if exists transcript_line_edits_field;
alter table public.transcript_line_edits add constraint transcript_line_edits_field check (field in ('text', 'speaker'));

create or replace function public.edit_transcript_speaker(p_session_id uuid, p_seq integer, p_speaker text, p_editor uuid)
  returns integer
  language plpgsql security definer set search_path = public as $$
declare
  v_cur integer;
  v_company uuid;
  v_old text;
begin
  if p_speaker is null or p_speaker not in ('agent', 'customer') then
    raise exception 'transcript edit: the speaker must be the rep or the customer' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_session_id::text, 2690));
  select company_id into v_company from coaching_sessions where id = p_session_id;
  if v_company is null then
    raise exception 'transcript edit: no such call' using errcode = 'P0002';
  end if;
  select max(version) into v_cur from coaching_transcript_segments where session_id = p_session_id;
  if v_cur is null then
    raise exception 'transcript edit: this call has no transcript' using errcode = 'P0002';
  end if;
  select speaker into v_old from coaching_transcript_segments where session_id = p_session_id and version = v_cur and seq = p_seq;
  if not found then
    raise exception 'transcript edit: no such line' using errcode = 'P0002';
  end if;
  if v_old = p_speaker then
    return v_cur; -- already that speaker: no new version, no edit row
  end if;
  insert into coaching_transcript_segments (session_id, speaker, text, seq, spoken_at, ended_at, source, speaker_cluster, version)
  select session_id, case when seq = p_seq then p_speaker else speaker end, text, seq, spoken_at, ended_at, source, speaker_cluster, v_cur + 1
  from coaching_transcript_segments
  where session_id = p_session_id and version = v_cur;
  insert into transcript_line_edits (company_id, session_id, seq, from_version, to_version, edited_by, field)
  values (v_company, p_session_id, p_seq, v_cur, v_cur + 1, p_editor, 'speaker');
  return v_cur + 1;
end $$;

revoke all on function public.edit_transcript_speaker(uuid, integer, text, uuid) from public, anon, authenticated;
grant execute on function public.edit_transcript_speaker(uuid, integer, text, uuid) to service_role;
