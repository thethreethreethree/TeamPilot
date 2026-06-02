-- 0010 — Team Chat (the primary user surface for the §3.1 chain)
--
-- Constitutional positioning: a chat_topic is a multi-user diagnosis space —
-- a problem hypothesis being collaboratively assembled. Messages are §3.1
-- events (append-only, immutable). Pins elevate messages to signals (the
-- candidate evidence that feeds the Understanding Gate). Closing a topic is
-- a resolution and emits a problem.resolved event into the chain.
--
-- Phase 1 scope: schema + immutability + RLS + close mechanism.
-- Phase 2 (deferred): AI dialogue routes, analytics, similarity, media uploads.

-- ─────────────────────────────────────────────────────────────
-- chat_topics — the conversation containers
-- ─────────────────────────────────────────────────────────────

create table if not exists chat_topics (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  title           text not null,
  description     text,
  -- Optional link: a chat_topic can BE a problem (if the chat is the diagnostic
  -- space). When the topic is closed, the linked problem is resolved.
  problem_id      uuid references problems(id) on delete set null,
  status          text not null default 'open'
                  check (status in ('open', 'closed', 'archived')),
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  closed_at       timestamptz,
  closed_by       uuid references auth.users(id) on delete set null,
  close_summary   text,
  -- Filled when the close is reviewed for §3.5 consequence measurement.
  -- Mirrors the resolutions.durability vocabulary.
  close_durability text check (close_durability in ('held', 'reopened', 'partial', 'unknown')),
  -- For similarity matching (Phase 5). Free-text tags; later: embeddings.
  tags            text[] not null default '{}'
);

create index if not exists chat_topics_company_status_idx
  on chat_topics (company_id, status, created_at desc);

-- Topic-level immutability: title, description, created_at, created_by are
-- locked once the row exists. Status, closed_*, durability, tags can change.
create or replace function check_topic_immutability()
returns trigger language plpgsql as $$
begin
  if OLD.company_id is distinct from NEW.company_id then raise exception 'chat_topics.company_id is immutable'; end if;
  if OLD.created_at is distinct from NEW.created_at then raise exception 'chat_topics.created_at is immutable'; end if;
  if OLD.created_by is distinct from NEW.created_by then raise exception 'chat_topics.created_by is immutable'; end if;
  -- title / description editable while open; locked once closed
  if OLD.status = 'closed' then
    if OLD.title is distinct from NEW.title then raise exception 'chat_topics.title is immutable after close'; end if;
    if OLD.description is distinct from NEW.description then raise exception 'chat_topics.description is immutable after close'; end if;
  end if;
  return NEW;
end $$;

drop trigger if exists chat_topics_immutable on chat_topics;
create trigger chat_topics_immutable
  before update on chat_topics
  for each row execute function check_topic_immutability();

-- ─────────────────────────────────────────────────────────────
-- chat_participants — who's in the room
-- ─────────────────────────────────────────────────────────────

create table if not exists chat_participants (
  topic_id    uuid not null references chat_topics(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'member'
              check (role in ('admin', 'member', 'observer')),
  joined_at   timestamptz not null default now(),
  left_at     timestamptz,
  -- Per-user analytics — message_count + last_seen_at are touched by triggers
  -- below. participation_score is computed externally (Phase 4).
  message_count int not null default 0,
  last_seen_at  timestamptz,
  primary key (topic_id, user_id)
);

create index if not exists chat_participants_user_idx
  on chat_participants (user_id, joined_at desc);

-- ─────────────────────────────────────────────────────────────
-- chat_messages — append-only event log (§3.1)
-- ─────────────────────────────────────────────────────────────

create table if not exists chat_messages (
  id            uuid primary key default gen_random_uuid(),
  topic_id      uuid not null references chat_topics(id) on delete cascade,
  company_id    uuid not null references companies(id) on delete cascade,
  author_id     uuid references auth.users(id) on delete set null,
  -- 'message' is the default; 'system' is for joined/left/closed events;
  -- 'summary' is for AI-generated summaries; 'pin' is for elevated content.
  kind          text not null default 'message'
                check (kind in ('message', 'system', 'summary', 'voice', 'attachment')),
  body          text,
  -- For voice/attachment kinds, this references storage. Phase 6.
  media_url     text,
  media_type    text,
  -- For replies / threads — references the parent message.
  reply_to_id   uuid references chat_messages(id) on delete set null,
  -- Whether the AI 'guide-my-response' was used to draft this message.
  ai_assisted   boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists chat_messages_topic_created_idx
  on chat_messages (topic_id, created_at);

-- §3.1: messages are append-only. UPDATE and DELETE return without effect.
-- This is a stronger rule than the topic-level immutability above because
-- the conversation history is the source of truth for the diagnostic record.
create or replace rule chat_messages_no_update as
  on update to chat_messages do instead nothing;
create or replace rule chat_messages_no_delete as
  on delete to chat_messages do instead nothing;

-- Touch participant stats whenever a message lands.
create or replace function touch_participant_on_message()
returns trigger language plpgsql security invoker as $$
begin
  if NEW.author_id is not null and NEW.kind = 'message' then
    update chat_participants
      set message_count = message_count + 1,
          last_seen_at = NEW.created_at
      where topic_id = NEW.topic_id and user_id = NEW.author_id;
  end if;
  return NEW;
end $$;

drop trigger if exists chat_messages_touch_participant on chat_messages;
create trigger chat_messages_touch_participant
  after insert on chat_messages
  for each row execute function touch_participant_on_message();

-- ─────────────────────────────────────────────────────────────
-- chat_pins — messages elevated to "priority data assets"
--
-- Per the constitution: pins are signals. They are user-driven elevation of
-- raw events to signal status. They feed the Understanding Gate alongside
-- automatically-derived signals from the events chain.
-- ─────────────────────────────────────────────────────────────

create table if not exists chat_pins (
  id            uuid primary key default gen_random_uuid(),
  message_id    uuid not null references chat_messages(id) on delete cascade,
  topic_id      uuid not null references chat_topics(id) on delete cascade,
  company_id    uuid not null references companies(id) on delete cascade,
  pinned_by     uuid references auth.users(id) on delete set null,
  reason        text, -- why this matters; helps the brain learn what to flag
  -- Once we have a real signals table populated by derive_signals_for_event,
  -- the pinned message can be elevated to a signal there. Until then, pins are
  -- the priority-data-assets surface.
  signal_id     uuid references signals(id) on delete set null,
  pinned_at     timestamptz not null default now(),
  unpinned_at   timestamptz,
  unique (message_id) -- one pin per message; re-pin updates `unpinned_at` back to null
);

create index if not exists chat_pins_topic_idx on chat_pins (topic_id);

-- ─────────────────────────────────────────────────────────────
-- RLS — per-company isolation, plus participant-scoped access
-- ─────────────────────────────────────────────────────────────

alter table chat_topics       enable row level security;
alter table chat_participants enable row level security;
alter table chat_messages     enable row level security;
alter table chat_pins         enable row level security;

-- chat_topics: company members can see all topics in their company.
create policy "chat_topics - select" on chat_topics
  for select using (company_id = auth_company_id());
create policy "chat_topics - insert" on chat_topics
  for insert with check (company_id = auth_company_id());
create policy "chat_topics - update" on chat_topics
  for update using (company_id = auth_company_id());

-- chat_participants: any company member can see participation rosters.
create policy "chat_participants - select" on chat_participants
  for select using (
    exists (select 1 from chat_topics t
            where t.id = chat_participants.topic_id
              and t.company_id = auth_company_id())
  );
create policy "chat_participants - insert" on chat_participants
  for insert with check (
    exists (select 1 from chat_topics t
            where t.id = chat_participants.topic_id
              and t.company_id = auth_company_id())
  );
create policy "chat_participants - update" on chat_participants
  for update using (
    exists (select 1 from chat_topics t
            where t.id = chat_participants.topic_id
              and t.company_id = auth_company_id())
  );

-- chat_messages: only visible to participants of the topic (privacy by default).
-- This is stricter than the company-wide policy on topics — a topic might be
-- listed in /dashboard/chats but its messages only readable to participants.
create policy "chat_messages - select" on chat_messages
  for select using (
    company_id = auth_company_id()
    and exists (
      select 1 from chat_participants p
      where p.topic_id = chat_messages.topic_id
        and p.user_id = auth.uid()
        and p.left_at is null
    )
  );
create policy "chat_messages - insert" on chat_messages
  for insert with check (
    company_id = auth_company_id()
    and exists (
      select 1 from chat_participants p
      where p.topic_id = chat_messages.topic_id
        and p.user_id = auth.uid()
        and p.left_at is null
    )
  );

-- chat_pins: company-wide select (pins are organizational assets);
-- insert restricted to participants.
create policy "chat_pins - select" on chat_pins
  for select using (company_id = auth_company_id());
create policy "chat_pins - insert" on chat_pins
  for insert with check (
    company_id = auth_company_id()
    and exists (
      select 1 from chat_participants p
      where p.topic_id = chat_pins.topic_id
        and p.user_id = auth.uid()
        and p.left_at is null
    )
  );
create policy "chat_pins - update" on chat_pins
  for update using (
    company_id = auth_company_id()
    and exists (
      select 1 from chat_participants p
      where p.topic_id = chat_pins.topic_id
        and p.user_id = auth.uid()
        and p.left_at is null
    )
  );

-- ─────────────────────────────────────────────────────────────
-- close_topic() — admin RPC that closes a topic atomically
--
-- Constitutional contract: if the topic is linked to a problem, closing the
-- topic also marks the problem resolved AND emits the problem.resolved event
-- into the §3.1 chain. The conversation history becomes the audit trail.
-- ─────────────────────────────────────────────────────────────

create or replace function close_topic(
  p_topic_id   uuid,
  p_summary    text
)
returns void
language plpgsql
security invoker
as $$
declare
  v_topic   chat_topics;
  v_user_id uuid := auth.uid();
  v_is_admin boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_topic from chat_topics where id = p_topic_id;
  if v_topic.id is null then
    raise exception 'Topic not found';
  end if;

  -- Verify the closing user is an admin of this topic OR the company-level CEO/COO.
  select exists (
    select 1 from chat_participants
    where topic_id = p_topic_id
      and user_id = v_user_id
      and role = 'admin'
  ) or exists (
    select 1 from profiles
    where id = v_user_id
      and company_id = v_topic.company_id
      and role in ('CEO', 'COO')
  ) into v_is_admin;

  if not v_is_admin then
    raise exception 'Only topic admins or company CEO/COO can close a topic';
  end if;

  if v_topic.status = 'closed' then
    raise exception 'Topic already closed';
  end if;

  -- Append a system message recording the close.
  insert into chat_messages (topic_id, company_id, author_id, kind, body)
  values (p_topic_id, v_topic.company_id, v_user_id, 'system',
          'Topic closed: ' || coalesce(p_summary, '(no summary)'));

  -- Mark the topic closed.
  update chat_topics
     set status = 'closed',
         closed_at = now(),
         closed_by = v_user_id,
         close_summary = p_summary
   where id = p_topic_id;

  -- If linked to a problem, mark it resolved AND emit the chain event.
  if v_topic.problem_id is not null then
    update problems
       set status = 'resolved',
           resolved_at = now()
     where id = v_topic.problem_id;
    perform record_event(
      'problem.resolved',
      'problem:' || v_topic.problem_id::text,
      jsonb_build_object(
        'problem_id', v_topic.problem_id,
        'closed_via_chat_topic', p_topic_id,
        'close_summary', p_summary
      )
    );
  end if;
end;
$$;
