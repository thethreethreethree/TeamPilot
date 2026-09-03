-- 0245 — Realtime for manager notifications (founder 2026-09-04: push the alerts live, not on the 60s poll).
--
-- Adds manager_notifications to the `supabase_realtime` publication so the manager's NotificationBell can subscribe
-- to new alerts (INSERT) over Supabase Realtime and show them INSTANTLY. The 0242 RLS (recipient_id = auth.uid())
-- is enforced per-subscriber by Realtime — a manager only ever receives their OWN notifications, never a peer's —
-- and the browser subscription authenticates with the user's session, so the same rule the REST reads use applies.
-- We subscribe to INSERT only, so the default replica identity (PK) is sufficient; the new row is complete in the
-- WAL for the recipient_id filter + the RLS check. The in-app 60s poll stays as a fallback for a dropped socket.
--
-- Idempotent + guarded: only adds the table if the publication exists and doesn't already carry it, so a re-run
-- (or a project where it's already published) is a no-op rather than an error.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'manager_notifications'
    ) then
      alter publication supabase_realtime add table public.manager_notifications;
    end if;
  end if;
end $$;
