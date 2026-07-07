-- 0097 — dissect_topics: saved "Dissect a Conversation" topics
--
-- Feature: Dissect a Conversation (founder 2026-07-07). A user pastes any
-- conversation; the System summarizes it and dissects it through a PROBLEM-
-- SOLVING lens (§1 Living Diagnosis applied to a pasted conversation), plus an
-- Ask Coach thread (§3.3 guide-don't-overtake). The working thread is EPHEMERAL
-- (per-chat) and never touches the DB — nothing persists unless the user hits
-- "Save the topic". This table holds only SAVED topics.
--
-- Founder decisions (AskUserQuestion 2026-07-07):
--  • Close deletes an UNSAVED thread (pure client state — no row here); a SAVED
--    topic PERSISTS on Close. So there is intentionally NO delete path on this
--    table — a saved dissection is a committed asset (§3.1 never delete; §1.1
--    nothing discarded). List hygiene, if wanted later, is an archive flag, not
--    a hard delete.
--  • Saved dissections are STANDALONE (their own list) — they do NOT feed the
--    §3.1 events/problems/signals chain. This table is deliberately outside that
--    chain; promoting a dissection into a real Problem is a possible later bridge.
--
-- Visibility: owner-private (each user's own saved dissections, §A10 — the user
-- sees their own). RLS ties both read and write to the authenticated user, and
-- the insert WITH CHECK also pins company_id to auth_company_id() (the column
-- hardening pattern from 0090-0095 — a tenant key must not be user-forgeable).

create table if not exists dissect_topics (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  title         text not null,
  source_text   text not null,               -- the pasted conversation
  summary       text,                         -- LLM summary of the content
  dissect       jsonb,                        -- the problem-solving dissection
  created_at    timestamptz not null default now()
);

create index if not exists dissect_topics_user_created_idx
  on dissect_topics (user_id, created_at desc);

alter table dissect_topics enable row level security;

-- Owner-only read: a user sees only their own saved dissections.
drop policy if exists "dissect_topics - select own" on dissect_topics;
create policy "dissect_topics - select own" on dissect_topics
  for select using (user_id = auth.uid());

-- Owner-only insert: user_id must be the caller; company_id must be the caller's
-- own company (not a user-supplied foreign tenant — mirrors the 0090-0095 guard).
drop policy if exists "dissect_topics - insert own" on dissect_topics;
create policy "dissect_topics - insert own" on dissect_topics
  for insert with check (
    user_id = auth.uid()
    and company_id = auth_company_id()
  );

-- No UPDATE / DELETE policy: a saved dissection is append-only (§3.1). Editing or
-- removing is out of scope for v1 by design, not omission.
