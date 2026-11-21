-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0281 — RSS Phase 6: follow-through (Gong F25.11, F26.4, F13.8, F13.9, F13.13)
-- ═════════════════════════════════════════════════════════════════════════════════════════════
--
-- The plan says Phase 6 "needs no migration". It does, for three facts that would otherwise be lost:
--   1. session_follow_through — the AI's read of one transcript version: a suggested outcome (with why and the line
--      it rests on) and the callbacks the customer asked for ("call me Thursday"). Stored once per version so the
--      page shows the same read every time and the AI is not re-billed on every page view. Append-only.
--   2. callback_tasks — which callback became which task, so it is offered once and the link survives (§3.1).
--   3. ask_coach_chats / ask_coach_turns — Ask Coach becomes multi-turn and SAVED (F13.8). A chat is the asker's
--      own: a rep's questions to the coach about their weak moments are not a manager's to read (A10 — no shadow
--      read). Append-only; the answer's timestamp citations are stored with it.
--
-- Read rules reuse the session's (owner, or a manager under 0273's tree) except chats (owner only). No client
-- writes: routes and the pipeline write with the service role after their own checks. Idempotent (A12).
-- ═════════════════════════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from pg_proc where proname = 'rss_tree_allows') then
    raise exception 'RSS preflight: rss_tree_allows() not found — apply 0273 first';
  end if;
end $$;

create table if not exists public.session_follow_through (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.coaching_sessions(id) on delete cascade,
  company_id uuid not null references public.companies(id),
  rep_id uuid not null references public.profiles(id),
  transcript_version integer not null,
  -- Null = the AI could not tell (said so) — never a guess dressed as a read.
  suggested_outcome text check (suggested_outcome in ('sold', 'follow_up', 'no_sale', 'undecided')),
  outcome_why text,
  outcome_seq integer,
  -- [{ what, due: 'YYYY-MM-DD' | null, quote, seq, atMs }] — every quote verified against its line before storing.
  callbacks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint session_follow_through_once unique (session_id, transcript_version)
);
alter table public.session_follow_through enable row level security;
drop policy if exists rss_ft_select on public.session_follow_through;
create policy rss_ft_select on public.session_follow_through for select to authenticated
  using (company_id = auth_company_id() and (rep_id = auth.uid() or (is_sales_coach_manager() and rss_tree_allows(rep_id))));
create or replace rule session_follow_through_no_update as on update to public.session_follow_through do instead nothing;
create or replace rule session_follow_through_no_delete as on delete to public.session_follow_through do instead nothing;

create table if not exists public.callback_tasks (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id),
  follow_through_id uuid not null references public.session_follow_through(id),
  item_index integer not null check (item_index >= 0),
  task_id uuid not null references public.tasks(id),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint callback_tasks_once unique (follow_through_id, item_index)
);
alter table public.callback_tasks enable row level security;
drop policy if exists rss_cbt_select on public.callback_tasks;
create policy rss_cbt_select on public.callback_tasks for select to authenticated
  using (company_id = auth_company_id()
         and exists (select 1 from session_follow_through f where f.id = callback_tasks.follow_through_id)); -- f's own RLS
create or replace rule callback_tasks_no_update as on update to public.callback_tasks do instead nothing;
create or replace rule callback_tasks_no_delete as on delete to public.callback_tasks do instead nothing;

create table if not exists public.ask_coach_chats (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  owner_id uuid not null references public.profiles(id),
  session_ids uuid[] not null check (cardinality(session_ids) between 1 and 10),
  title text not null check (length(trim(title)) between 1 and 120),
  created_at timestamptz not null default now()
);
create index if not exists ask_coach_chats_owner_idx on public.ask_coach_chats (owner_id, created_at desc);
alter table public.ask_coach_chats enable row level security;
drop policy if exists rss_chats_select on public.ask_coach_chats;
create policy rss_chats_select on public.ask_coach_chats for select to authenticated
  using (company_id = auth_company_id() and owner_id = auth.uid());
create or replace rule ask_coach_chats_no_update as on update to public.ask_coach_chats do instead nothing;
create or replace rule ask_coach_chats_no_delete as on delete to public.ask_coach_chats do instead nothing;

create table if not exists public.ask_coach_turns (
  id bigint generated always as identity primary key,
  chat_id uuid not null references public.ask_coach_chats(id),
  company_id uuid not null references public.companies(id),
  role text not null check (role in ('user', 'coach')),
  content text not null check (length(content) between 1 and 8000),
  -- [{ ref: 3, sessionId, seq, atMs }] — what each [n] in the answer points at.
  citations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists ask_coach_turns_chat_idx on public.ask_coach_turns (chat_id, id);
alter table public.ask_coach_turns enable row level security;
drop policy if exists rss_turns_select on public.ask_coach_turns;
create policy rss_turns_select on public.ask_coach_turns for select to authenticated
  using (company_id = auth_company_id()
         and exists (select 1 from ask_coach_chats c where c.id = ask_coach_turns.chat_id)); -- the chat's own RLS
create or replace rule ask_coach_turns_no_update as on update to public.ask_coach_turns do instead nothing;
create or replace rule ask_coach_turns_no_delete as on delete to public.ask_coach_turns do instead nothing;
