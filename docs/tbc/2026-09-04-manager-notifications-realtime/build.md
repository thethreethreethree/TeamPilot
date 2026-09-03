# BUILD — Realtime manager notifications

### The publication (config, in-repo)
- write-path: `supabase/migrations/0245_manager_notifications_realtime.sql` — idempotently adds
  `public.manager_notifications` to the `supabase_realtime` publication (guarded on the publication existing + the
  table not already present, so a re-run is a no-op).
- read-path: with the table published, Supabase Realtime streams its INSERTs to authenticated subscribers, applying
  the 0242 recipient-RLS per subscriber — a manager receives only their own alerts.

### The subscription (client)
- write-path: `src/components/sales-coach/NotificationBell.tsx` — a new effect creates the browser client
  (`@/lib/supabase/client`), resolves the caller via `auth.getUser()`, and subscribes to a
  `manager-notifs:<uid>` channel on `postgres_changes` INSERT for `manager_notifications` with
  `filter: recipient_id=eq.<uid>`; each event calls `load()` (re-fetch). The 60s poll stays as the fallback; a
  CHANNEL_ERROR/TIMED_OUT is logged; the channel is removed on unmount (guarded by `supabaseEnabled`).
- read-path: a manager with the bell mounted sees a new strong-session / deal-closed alert appear + the unread
  badge tick up the instant the row is inserted, with no refresh; if the socket drops, the poll reconciles within 60s.

## Files
- `supabase/migrations/0245_manager_notifications_realtime.sql` (NEW)
- `src/components/sales-coach/NotificationBell.tsx` (realtime subscription + doc update)
- `src/components/sales-coach/__tests__/NotificationBell.render.test.tsx` (NEW, 4 tests)

## Ripple (§6 item 5)
- No schema/data change beyond the publication membership; RLS (0242) is the unchanged security boundary, now also
  enforced on the realtime path per subscriber.
- First `.channel()` in the app — isolated to the bell; the browser client already exists and is cookie-authed.
- The poll is retained (not removed), so the feature degrades safely if Realtime is disabled/unreachable.
