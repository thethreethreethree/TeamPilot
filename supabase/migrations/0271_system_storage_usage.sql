-- 0271 — how much file storage and database space the project is using, so /api/health can warn before a quota.
--
-- WHY. On 2026-11-11 users could not sign in: the Supabase project was suspended for
-- `exceed_storage_size_quota`, and every request (sign-in included) returned 402. Nothing in the app measured
-- storage, and /api/health reported "ok" throughout. The main writer is sales-call audio: recording-purge-cron
-- keeps each rep's last 20 unsaved recordings, saved ones forever, and 0241 allows 250 MB per file — a retention
-- rule with no relation to the plan's quota.
--
-- WHAT. One read-only function returning total bytes in storage.objects and the database size. security definer
-- because storage.objects is not readable through PostgREST; execute is granted to service_role ONLY (the
-- health route calls it with the admin client and publishes percentages, never bucket names or sizes).
-- search_path pinned (A23 / 0088). Safe to re-run (A12).

create or replace function public.system_storage_usage()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'storage_bytes', coalesce((select sum((o.metadata->>'size')::bigint) from storage.objects o), 0),
    'db_bytes', pg_database_size(current_database())
  );
$$;

revoke all on function public.system_storage_usage() from public;
revoke all on function public.system_storage_usage() from anon, authenticated;
grant execute on function public.system_storage_usage() to service_role;
