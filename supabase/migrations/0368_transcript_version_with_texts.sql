-- 0368 — a new transcript version with some lines' text replaced (2026-11-26; Gong ledger F8.9; founder picker
-- 2026-11-26: re-apply vocabulary corrections to past calls "On request, with a count"). Idempotent (A12).
--
-- Like copy_transcript_version (0284) — same per-call advisory lock, every line copied to version + 1 — except that the
-- lines named in p_texts ({"<seq>": "<text>"}) get that text. Refuses (returns -1) when the call's current version is
-- no longer p_from_version, so a correction never overwrites a newer edit, trim or relabel made in between. Lines are
-- never edited in place (§3.1): the old version stays as history; the current view reads the new one. Service role
-- only; the caller (the vocabulary re-apply route, company admins) re-runs the call's AI reads afterwards.

create or replace function public.rss_transcript_version_with_texts(p_session_id uuid, p_from_version integer, p_texts jsonb)
returns integer
  language plpgsql security definer set search_path = public as $$
declare
  v_cur integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_session_id::text, 2690));
  select max(version) into v_cur from coaching_transcript_segments where session_id = p_session_id;
  if v_cur is null or v_cur <> p_from_version then
    return -1;
  end if;
  insert into coaching_transcript_segments (session_id, speaker, text, seq, spoken_at, ended_at, source, speaker_cluster, version)
  select session_id, speaker, coalesce(p_texts ->> seq::text, text), seq, spoken_at, ended_at, source, speaker_cluster, v_cur + 1
  from coaching_transcript_segments
  where session_id = p_session_id and version = v_cur;
  return v_cur + 1;
end;
$$;
revoke all on function public.rss_transcript_version_with_texts(uuid, integer, jsonb) from public;
revoke execute on function public.rss_transcript_version_with_texts(uuid, integer, jsonb) from anon, authenticated;
grant execute on function public.rss_transcript_version_with_texts(uuid, integer, jsonb) to service_role;
