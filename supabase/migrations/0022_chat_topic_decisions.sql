-- 0022 — In-thread Decision Dialogue
--
-- Constitutional positioning: the Decision Dialogue surface from
-- /dashboard/decisions is the structural interrupt that enforces §3.3
-- (guide-don't-overtake) — the System will not assert a decision until
-- the user has stated their own diagnosis and proposal. Forcing users
-- to leave their chat thread to run that dialogue means the discipline
-- only happens when someone remembers to navigate. In-thread Decision
-- Dialogue closes that gap: the four phases run AS PART OF THE
-- CONVERSATION, with the chat history available as context and each
-- phase advance landing as a system message on the thread record.
--
-- One open decision dialogue per topic at a time (unique constraint).
-- The row carries draft state through phases 'situation' → 'elicit' →
-- 'respond' → 'decide'. On Decide, the row freezes and a write-through
-- happens to the existing `decisions` + `decision_dialogues` tables so
-- the §3.1 record matches the off-thread path and Decision Memory keeps
-- working as-is.
--
-- Cancellation: per A1 (data-as-asset), no row is ever deleted by
-- application code. A dialogue opened by mistake gets resolved to
-- phase='decide' / chosen_path='defer', which IS the constitutional
-- meaning of "not enough understanding yet."

-- ─────────────────────────────────────────────────────────────
-- chat_topic_decisions — the in-thread dialogue state
-- ─────────────────────────────────────────────────────────────

create table if not exists chat_topic_decisions (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references companies(id) on delete cascade,
  topic_id              uuid not null references chat_topics(id) on delete cascade,
  opened_by             uuid references auth.users(id) on delete set null,
  opened_at             timestamptz not null default now(),
  -- Phase progression. 'decided' is the terminal state after the row
  -- has write-through-persisted to decisions/decision_dialogues. The
  -- in-thread card folds to a one-line summary once decided.
  phase                 text not null default 'situation'
                        check (phase in ('situation','elicit','respond','decide','decided')),
  -- Draft state for each phase. All nullable; the UI gates advancement
  -- by checking required fields are non-empty.
  situation             text,
  user_diagnosis        text,
  user_proposal         text,
  -- The full system response object (engagement / addedPerspective /
  -- suggestion{action,why} / comparison). Stored as jsonb so we don't
  -- denormalize the same shape used by the existing /api/ai/decision-
  -- dialogue route.
  system_response       jsonb,
  chosen_path           text check (chosen_path in ('user','system','hybrid','defer')),
  chosen_note           text,
  decided_at            timestamptz,
  -- After finalization, the in-thread row links to the canonical
  -- `decisions` row that the off-thread path also writes to. Lets the
  -- Decision Memory list show in-thread decisions identically.
  persisted_decision_id uuid references decisions(id) on delete set null,
  updated_at            timestamptz not null default now(),
  -- One open dialogue per topic. If a previous dialogue is decided
  -- (phase='decided'), a new one CAN be opened — the partial unique
  -- index below scopes uniqueness to non-decided rows only.
  constraint chat_topic_decisions_unique unique (topic_id)
);

-- Drop and recreate the unique constraint as a partial index so a topic
-- can carry multiple HISTORICAL decided dialogues but only one OPEN one
-- at a time. The named constraint above was the wrong shape for that —
-- it would block a second decided dialogue from ever opening.
alter table chat_topic_decisions drop constraint chat_topic_decisions_unique;
create unique index if not exists chat_topic_decisions_one_open_idx
  on chat_topic_decisions (topic_id)
  where phase <> 'decided';

create index if not exists chat_topic_decisions_company_opened_idx
  on chat_topic_decisions (company_id, opened_at desc);

create index if not exists chat_topic_decisions_topic_idx
  on chat_topic_decisions (topic_id, opened_at desc);

-- ─────────────────────────────────────────────────────────────
-- Immutability — once decided, the row is frozen.
--
-- Before decided_at is set, the row is editable: that's the working
-- surface of the dialogue. Once decided_at is set (phase='decided'),
-- every column locks. This mirrors the §3.1 append-only discipline that
-- decision_dialogues uses on the off-thread path.
-- ─────────────────────────────────────────────────────────────

create or replace function check_chat_topic_decision_immutability()
returns trigger language plpgsql as $$
begin
  -- Company and topic linkage is always immutable.
  if OLD.company_id is distinct from NEW.company_id then
    raise exception 'chat_topic_decisions.company_id is immutable';
  end if;
  if OLD.topic_id is distinct from NEW.topic_id then
    raise exception 'chat_topic_decisions.topic_id is immutable';
  end if;
  if OLD.opened_at is distinct from NEW.opened_at then
    raise exception 'chat_topic_decisions.opened_at is immutable';
  end if;
  if OLD.opened_by is distinct from NEW.opened_by then
    raise exception 'chat_topic_decisions.opened_by is immutable';
  end if;
  -- Once decided, everything locks.
  if OLD.phase = 'decided' then
    if OLD.phase is distinct from NEW.phase
       or OLD.situation is distinct from NEW.situation
       or OLD.user_diagnosis is distinct from NEW.user_diagnosis
       or OLD.user_proposal is distinct from NEW.user_proposal
       or OLD.system_response is distinct from NEW.system_response
       or OLD.chosen_path is distinct from NEW.chosen_path
       or OLD.chosen_note is distinct from NEW.chosen_note
       or OLD.decided_at is distinct from NEW.decided_at
       or OLD.persisted_decision_id is distinct from NEW.persisted_decision_id
    then
      raise exception 'chat_topic_decisions are immutable once decided';
    end if;
  end if;
  -- Touch updated_at on legitimate edits.
  NEW.updated_at := now();
  return NEW;
end $$;

drop trigger if exists chat_topic_decisions_immutable on chat_topic_decisions;
create trigger chat_topic_decisions_immutable
  before update on chat_topic_decisions
  for each row execute function check_chat_topic_decision_immutability();

-- ─────────────────────────────────────────────────────────────
-- RLS — company-scoped read, participant-scoped write
-- ─────────────────────────────────────────────────────────────

alter table chat_topic_decisions enable row level security;

-- Select: any company member can see in-thread decisions. They are
-- thread artifacts and the topic itself is already visible at the
-- company level.
drop policy if exists "chat_topic_decisions - select" on chat_topic_decisions;
create policy "chat_topic_decisions - select" on chat_topic_decisions
  for select using (company_id = auth_company_id());

-- Insert: company member AND active participant of the topic. We
-- additionally gate "admin-only open" at the API layer (§3.3 admin is
-- the decision-runner for the room), but RLS-level enforcement keeps
-- the check honest if the API surface ever gets bypassed.
drop policy if exists "chat_topic_decisions - insert" on chat_topic_decisions;
create policy "chat_topic_decisions - insert" on chat_topic_decisions
  for insert with check (
    company_id = auth_company_id()
    and exists (
      select 1 from chat_participants p
      where p.topic_id = chat_topic_decisions.topic_id
        and p.user_id = auth.uid()
        and p.left_at is null
    )
  );

-- Update: same gate. Once-decided immutability is enforced at the
-- trigger level, so this is "any active participant can drive the
-- dialogue forward" — which is the right shape for a collaborative
-- diagnostic surface.
drop policy if exists "chat_topic_decisions - update" on chat_topic_decisions;
create policy "chat_topic_decisions - update" on chat_topic_decisions
  for update using (
    company_id = auth_company_id()
    and exists (
      select 1 from chat_participants p
      where p.topic_id = chat_topic_decisions.topic_id
        and p.user_id = auth.uid()
        and p.left_at is null
    )
  );

-- Delete: no policy. Per A1, an opened-by-mistake dialogue is resolved
-- as 'defer', never deleted. The RLS audit allowlist captures this.
