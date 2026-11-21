-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0300 — where a live recording's audio clock starts (OPEN.md review 2026-11-20: "a trim maps audio time to lines via
--        spoken_at − started_at; a recording that started late could trim the wrong lines")
-- ═════════════════════════════════════════════════════════════════════════════════════════════
--
-- MEASURED (production, read-only, 2026-11-21): uploaded calls are exact by construction — label-transcript sets
-- spoken_at = started_at + the line's offset into the file. Live sessions are not: spoken_at comes from the BROWSER's
-- clock (useLiveCoaching utteranceStartRef) while started_at is the SERVER's, and the recorder starts when the mic is
-- ready, not when the row was created. Chunk 0 landed 17.5–18.7 s after started_at on 6 of 7 live sessions (≈ the
-- 15 s chunk + upload: on time) and 74.1 s on one — a recorder ~56 s late, where a trim would miss its lines by up to
-- a minute. A trim is a privacy tool: a missed trim hides the wrong words and leaves the sensitive ones readable.
--
-- THE FIX: audio_started_at = the moment the recorder started, on the SAME browser clock as spoken_at, sent with
-- chunk 0. Then spoken_at − audio_started_at is the true position in the audio and clock skew cancels. When it is
-- null (uploads, older sessions, a lost chunk 0) everything uses started_at exactly as before.
--
-- TAMPER-PROOF: the session's own rep may update their row (0001-era policy). A rep who could write this column could
-- slide the clock so a manager's privacy trim misses and the hidden words reappear. So a direct (authenticated/anon)
-- write is refused, and once set it never changes; only the audio-chunk route (service role) sets it.
--
-- rss_line_trimmed is 0298's body verbatim with its base changed to coalesce(audio_started_at, started_at) — the SQL
-- twin of audioBaseIso() (src/lib/coach/v5/segmentTiming.ts). Idempotent (A12).
-- ═════════════════════════════════════════════════════════════════════════════════════════════

alter table public.coaching_sessions add column if not exists audio_started_at timestamptz;
comment on column public.coaching_sessions.audio_started_at is
  'When the live recorder started, on the browser clock spoken_at uses (sent with audio chunk 0). Null → started_at is the audio clock (uploads, older sessions). Set once, service role only (0300).';

create or replace function public.rss_guard_audio_started_at() returns trigger
  language plpgsql as $$
begin
  if new.audio_started_at is distinct from old.audio_started_at then
    if current_user in ('authenticated', 'anon') then
      raise exception 'coaching_sessions.audio_started_at is set by the recording upload only';
    end if;
    if old.audio_started_at is not null then
      raise exception 'coaching_sessions.audio_started_at cannot change once set';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists rss_guard_audio_started_at on public.coaching_sessions;
create trigger rss_guard_audio_started_at before update of audio_started_at on public.coaching_sessions
  for each row execute function public.rss_guard_audio_started_at();

create or replace function public.rss_line_trimmed(p_session uuid, p_start timestamptz, p_end timestamptz) returns boolean
  language sql stable security definer set search_path = public as $$
  select p_start is not null and exists (
    select 1
    from recording_trims tr
    join coaching_sessions s on s.id = tr.session_id
    where tr.session_id = p_session
      and ((auth.uid() is null and coalesce(auth.role(), '') <> 'anon') or s.company_id = auth_company_id())
      and not exists (select 1 from recording_trim_restores r where r.trim_id = tr.id)
      and extract(epoch from (p_start - coalesce(s.audio_started_at, s.started_at))) * 1000 < tr.end_ms
      and extract(epoch from (coalesce(p_end, p_start) - coalesce(s.audio_started_at, s.started_at))) * 1000 >= tr.start_ms
  )
$$;
revoke all on function public.rss_line_trimmed(uuid, timestamptz, timestamptz) from public;
grant execute on function public.rss_line_trimmed(uuid, timestamptz, timestamptz) to anon, authenticated, service_role;
