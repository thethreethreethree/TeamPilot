-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0299 — recordings in storage that nothing points at (docs/STORAGE-ORPHANS-2026-11-21.md; founder: delete + sweeper)
-- ═════════════════════════════════════════════════════════════════════════════════════════════
--
-- Production held 463 audio files (401.5 MB) that no row references: no screen can play them, and §3.1.1 erasure —
-- which finds a customer's recordings through the session's pointer — cannot reach them. Two causes: the retention
-- purge as it ran 2026-07-16 → 2026-09-04 (fixed by removeRecordingAudio), and sign-then-commit uploads whose commit
-- never arrived (still possible by construction: the browser uploads, a later request records the path).
--
-- THE RULE, ONCE. rss_unreferenced_uploads is the single definition of "unreferenced", called by both the one-time
-- cleanup (scripts/sweep-unreferenced-uploads.mjs) and the nightly sweeper cron (§2.2: no caller re-derives it).
-- A file qualifies only when ALL hold:
--   · it is in assets-v1 under the dated upload shape `<company>/<yyyy>/<mm>/<file>` (buildStoragePath) — chunk and
--     stitched-recording paths are referenced by derivation, not by exact path, so they are never candidates;
--   · it is audio or video (images and documents are out of scope);
--   · it is older than p_min_age (an upload whose commit is seconds away is never touched);
--   · no column that can hold an upload's path names it. Those columns, and ONLY those, are listed below; INVARIANT 40
--     (scripts/invariant-audit.mjs) fails the build when a new route writes dated uploads, so a new referencing
--     column is added here before a sweeper can ever see its files as orphans.
-- Before the first deletion, every text/JSON column of all 158 public tables was scanned for the candidates' ids:
-- none mentioned any of them (docs/STORAGE-ORPHANS-2026-11-21.md).
--
-- Reads storage.objects, which PostgREST cannot expose, so SECURITY DEFINER; execute is the service role's only.
-- It lists — it never deletes: deleting rows here would orphan the bytes in the storage backend. Removal goes through
-- the Storage API in the callers. Idempotent (A12).
-- ═════════════════════════════════════════════════════════════════════════════════════════════

create or replace function public.rss_unreferenced_uploads(p_min_age interval, p_limit integer default 500)
returns table (name text, company_id uuid, bytes bigint, created_at timestamptz, mimetype text)
  language sql stable security definer set search_path = public, storage as $$
  with refs as (
    select audio_asset_url as ref from public.coaching_sessions where audio_asset_url is not null
    union all select audio_asset_url from public.coaching_retranscribe_cache where audio_asset_url is not null
    union all select storage_path from public.files where storage_path is not null
    union all select storage_path from public.care_rcd_media where storage_path is not null
    union all select storage_path from public.meeting_prep_documents where storage_path is not null
    union all select audio_url from public.pitch_scores where audio_url is not null
    union all select audio_path from public.pitches where audio_path is not null
  )
  select o.name,
         split_part(o.name, '/', 1)::uuid,
         coalesce((o.metadata ->> 'size')::bigint, 0),
         o.created_at,
         o.metadata ->> 'mimetype'
  from storage.objects o
  where o.bucket_id = 'assets-v1'
    and o.name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9]{4}/[0-9]{2}/[^/]+$'
    and ((o.metadata ->> 'mimetype') like 'audio/%' or (o.metadata ->> 'mimetype') like 'video/%')
    and o.created_at < now() - greatest(p_min_age, interval '1 hour')
    and not exists (select 1 from refs where position(o.name in refs.ref) > 0)
  order by o.created_at
  limit least(greatest(coalesce(p_limit, 500), 1), 1000)
$$;
revoke all on function public.rss_unreferenced_uploads(interval, integer) from public, anon, authenticated;
grant execute on function public.rss_unreferenced_uploads(interval, integer) to service_role;
