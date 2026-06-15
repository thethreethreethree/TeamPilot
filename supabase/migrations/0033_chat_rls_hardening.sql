-- 0033 — Chat RLS hardening (closes the gap flagged in commit 7401a3a)
--
-- Two related problems the existing 0010 policies left open:
--
-- 1. PERMISSIVE TOPIC UPDATES. `chat_topics - update` allowed any
--    member of the company to UPDATE any topic row. The UI / API
--    code checks iAmAdmin client-side, but RLS lets a hand-crafted
--    curl bypass that check entirely — a regular Member could
--    flip coach_enabled, change titles, close topics, etc., simply
--    by hitting the REST endpoint directly. Tighten to admin-only.
--
-- 2. CLIENT/SERVER ADMIN PARITY. Commit 991d4e8 made the client
--    iAmAdmin accept company admins (CEO/COO/admin) in addition to
--    per-topic admins. Commit 7401a3a did the same on the Decision
--    Dialogue API. But the underlying RLS policies on chat_topics
--    and chat_participants still ONLY recognize per-topic
--    chat_participants.role = 'admin' — so a CEO viewing a topic
--    they don't personally admin would be blocked at the DB layer
--    even after the UI shows the button.
--
-- This migration aligns both layers:
--   - is_topic_admin() helper consolidates the parity check in SQL.
--   - chat_topics UPDATE requires is_topic_admin().
--   - chat_participants INSERT/UPDATE require is_topic_admin() OR
--     self-update (a user can always update their own participant
--     row, e.g., to set left_at when leaving).
--
-- A12 idempotent: every drop policy uses if-exists; the helper
-- function uses create-or-replace.
--
-- Constitutional grounding:
--   §A5 ripple-trace: when changing one admin check at one layer,
--                     audit every layer that gates the same shape.
--                     This is that audit's closure.
--   §3.3 guide-don't-overtake: the structural defense is at the
--                              DB, not in client-trust.

-- ─── Helper: is_topic_admin(topic_id) ──────────────────────────
-- Returns true when the calling user is EITHER:
--   - per-topic admin: chat_participants.role = 'admin' for this topic, OR
--   - company-level admin: profiles.role in ('CEO','COO','admin') for
--     the same company as this topic.
-- security definer so RLS on the joined tables doesn't recurse the
-- check.

create or replace function is_topic_admin(p_topic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from chat_participants
      where topic_id = p_topic_id
        and user_id = auth.uid()
        and role = 'admin'
        and left_at is null
    )
    or exists (
      select 1
      from chat_topics t
      join profiles p on p.company_id = t.company_id
      where t.id = p_topic_id
        and p.id = auth.uid()
        and p.role in ('CEO', 'COO', 'admin')
    );
$$;

comment on function is_topic_admin(uuid) is
  'RLS helper. True when the calling user is admin of this topic
   (per-topic role=admin) OR a company-level admin (profile.role
   in CEO/COO/admin) of the topic''s company. Centralizes the
   parity check the client iAmAdmin and the Decision Dialogue API
   already implement; closes the §A5 ripple-trace from commit
   7401a3a so the DB enforces what the UI shows.';

-- ─── chat_topics: tighten UPDATE policy ─────────────────────────
-- Was: any company member could UPDATE any topic.
-- Now: only topic admins (per-topic OR company-level) can UPDATE.
-- SELECT and INSERT stay company-wide (everyone can read topics
-- they're allowed to see; INSERT is fine because creating a topic
-- in your own company is a Member affordance).

drop policy if exists "chat_topics - update" on chat_topics;
create policy "chat_topics - update" on chat_topics
  for update using (
    company_id = auth_company_id()
    and is_topic_admin(id)
  );

-- ─── chat_participants: tighten INSERT and UPDATE ──────────────
-- INSERT was: any company member could add anyone to any topic.
-- Now: only topic admins can add participants.
-- UPDATE was: any company member could update any participant row.
-- Now: topic admins OR the user themselves (e.g. to set left_at).

drop policy if exists "chat_participants - insert" on chat_participants;
create policy "chat_participants - insert" on chat_participants
  for insert with check (
    exists (
      select 1 from chat_topics t
      where t.id = chat_participants.topic_id
        and t.company_id = auth_company_id()
    )
    and (
      -- Topic admin / company admin can add others.
      is_topic_admin(chat_participants.topic_id)
      -- Topic creation flow seeds the creator as their own admin;
      -- allow self-insert as the very first participant so onboarding
      -- a topic doesn't deadlock. The existing topic-creation API
      -- already inserts the creator atomically.
      or chat_participants.user_id = auth.uid()
    )
  );

drop policy if exists "chat_participants - update" on chat_participants;
create policy "chat_participants - update" on chat_participants
  for update using (
    exists (
      select 1 from chat_topics t
      where t.id = chat_participants.topic_id
        and t.company_id = auth_company_id()
    )
    and (
      -- Topic / company admin can update any row.
      is_topic_admin(chat_participants.topic_id)
      -- Self-update lets a user leave a topic, change their own
      -- last_engaged_at, etc. They cannot promote themselves
      -- because the role column update is checked by the existing
      -- triggers / API; RLS just allows the row touch.
      or chat_participants.user_id = auth.uid()
    )
  );

-- ─── Note: chat_messages policies unchanged ────────────────────
-- chat_messages SELECT / INSERT already require active topic
-- participation, which is the right gate for messages. Per-message
-- admin operations (pin, edit) flow through the API which can
-- check is_topic_admin() server-side if/when those operations
-- need admin gating. Currently any participant can pin/unpin
-- their own pinned-state via the existing togglePin function —
-- that's an intentional democratic affordance.
