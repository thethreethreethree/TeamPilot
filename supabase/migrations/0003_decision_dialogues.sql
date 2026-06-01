-- 0003 — Persisted Decision Dialogues
--
-- Records the full guide-don't-overtake conversation (situation, user's diagnosis,
-- user's proposal, system response, chosen path) so the WHY survives past the moment
-- of decision. Per CLAUDE.md §2 "Explain the WHY, not just the WHAT" and §3.5
-- (consequence measurement needs the dialogue to compare against the outcome).
--
-- The existing decisions table from 0001 stays — it represents the *outcome* of a
-- dialogue. decision_dialogues represents the *process* that produced it. A decision
-- without a dialogue is allowed (manual entries, imported history); a dialogue without
-- a decision is the in-progress state.

create table if not exists decision_dialogues (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references companies(id) on delete cascade,
  decision_id       uuid references decisions(id) on delete set null,
  situation         text not null,
  user_diagnosis    text not null,
  user_proposal     text not null,
  system_engagement text,
  system_added_perspective text,
  system_suggestion_action text,
  system_suggestion_why    text,
  system_comparison text,
  chosen_path       text check (chosen_path in ('user','system','hybrid','defer')),
  chosen_note       text,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  decided_at        timestamptz
);

create index if not exists decision_dialogues_company_created_idx
  on decision_dialogues (company_id, created_at desc);

-- Append-only on the user-authored fields. The system response can be re-recorded
-- (same situation, different prompt) but each insert is a new row. Updates only
-- transition 'decided_at' / 'chosen_path' / 'chosen_note'.
create or replace function check_dialogue_immutability()
returns trigger language plpgsql as $$
begin
  if OLD.situation         is distinct from NEW.situation         then raise exception 'decision_dialogues.situation is immutable'; end if;
  if OLD.user_diagnosis    is distinct from NEW.user_diagnosis    then raise exception 'decision_dialogues.user_diagnosis is immutable'; end if;
  if OLD.user_proposal     is distinct from NEW.user_proposal     then raise exception 'decision_dialogues.user_proposal is immutable'; end if;
  if OLD.system_engagement is distinct from NEW.system_engagement then raise exception 'decision_dialogues.system_engagement is immutable'; end if;
  if OLD.system_suggestion_action is distinct from NEW.system_suggestion_action then raise exception 'decision_dialogues.system_suggestion_action is immutable'; end if;
  return NEW;
end $$;

drop trigger if exists decision_dialogues_immutable on decision_dialogues;
create trigger decision_dialogues_immutable
  before update on decision_dialogues
  for each row execute function check_dialogue_immutability();

-- RLS
alter table decision_dialogues enable row level security;

create policy "decision_dialogues - all" on decision_dialogues
  for all
  using (company_id = auth_company_id())
  with check (company_id = auth_company_id());
