-- 0029 — Web Push notification subscriptions
--
-- Foundation for the Team Chat PWA push notifications (Phase 2.1).
-- Each browser/device the user installs the PWA on registers a
-- subscription with the Web Push service (Apple Push, FCM, Mozilla
-- Push). The server stores the endpoint + crypto keys here so it
-- can send notifications when a relevant event fires (Phase 2.2).
--
-- Per A12 (migrations safe-to-re-run): every CREATE uses IF NOT
-- EXISTS, every policy/index name is unique enough that re-running
-- against a partially-applied DB is a clean no-op.

create table if not exists notification_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  company_id  uuid not null references companies(id) on delete cascade,
  -- Web Push endpoint URL — opaque to us. The push service routes
  -- by this URL. One per browser/device per user (deduped by the
  -- unique constraint below).
  endpoint    text not null,
  -- Per-subscription encryption keys. Required when calling the
  -- push service so the push service can decrypt the payload we
  -- send.
  p256dh      text not null,
  auth        text not null,
  -- Optional metadata for the user to identify their devices when
  -- managing subscriptions (e.g. "iPhone 15 Safari"). Captured at
  -- registration time from the request UA header.
  user_agent  text,
  -- Phase 2.2 may set this to false to soft-unsubscribe (e.g. after
  -- a push fails with 410 Gone). Filtering on enabled=true at
  -- fan-out time lets us recover gracefully without immediate delete.
  enabled     boolean not null default true,
  created_at  timestamptz not null default now(),
  last_used_at timestamptz
);

-- Each endpoint is globally unique by the push spec. Use that to
-- dedupe registrations — a re-register of the same browser just
-- updates the last_used_at + re-enables.
create unique index if not exists notification_subscriptions_endpoint_uniq
  on notification_subscriptions (endpoint);

-- Query path for fan-out: "give me all enabled subscriptions for
-- users in this set."
create index if not exists notification_subscriptions_user_enabled_idx
  on notification_subscriptions (user_id, enabled);

-- ─── RLS ──────────────────────────────────────────────────────
alter table notification_subscriptions enable row level security;

-- Users can SELECT only their own subscriptions (for managing
-- devices). They CANNOT see other users' device endpoints —
-- those are opaque routing tokens but still private.
drop policy if exists notification_subscriptions_select_own on notification_subscriptions;
create policy notification_subscriptions_select_own
  on notification_subscriptions for select
  using (user_id = auth.uid());

-- Users INSERT their own subscriptions via the API (which sets
-- user_id from auth.uid() in the server-side insert).
drop policy if exists notification_subscriptions_insert_own on notification_subscriptions;
create policy notification_subscriptions_insert_own
  on notification_subscriptions for insert
  with check (user_id = auth.uid());

-- Users can UPDATE their own subscriptions (e.g. to disable a
-- specific device or update last_used_at on re-register).
drop policy if exists notification_subscriptions_update_own on notification_subscriptions;
create policy notification_subscriptions_update_own
  on notification_subscriptions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Users can DELETE their own subscriptions (sign-out cleanup,
-- manual device-revoke).
drop policy if exists notification_subscriptions_delete_own on notification_subscriptions;
create policy notification_subscriptions_delete_own
  on notification_subscriptions for delete
  using (user_id = auth.uid());

-- The service role (server-side fan-out — Phase 2.2) bypasses RLS
-- entirely, so no policy is needed for that read path.

comment on table notification_subscriptions is
  'Web Push subscriptions for the Team Chat PWA (Phase 2.1). Each
   row is one browser/device. The push service routes by `endpoint`;
   we encrypt payloads with `p256dh` + `auth`. Phase 2.2 wires the
   server-side fan-out that reads from this table when chat messages
   land.';
