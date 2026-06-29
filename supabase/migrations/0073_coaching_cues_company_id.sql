-- 0073: add company_id to coaching_cues.
--
-- WHY (audit Finding 2 / option B): coaching_cues had no company_id, so a
-- company-wide cue total could only be approximated over a bounded window
-- of session ids (.in(...)). With company_id present, team-analytics can
-- count cues with an exact company-scoped count-head at any scale, and the
-- "windowed cue total" caveat retires.
--
-- Three things that make this safe + holistic (§1.5, §A12 idempotent):
--   1. coaching_cues is append-only via a `do instead nothing` UPDATE rule.
--      The backfill is an UPDATE, so the rule must be lifted for the
--      backfill and then restored — otherwise the backfill is silently
--      swallowed.
--   2. A BEFORE INSERT trigger auto-fills company_id from the parent
--      session, so no insert site (appendCue, etc.) has to set it — the
--      invariant is DB-enforced, not caller-trusted (§A21).
--   3. NOT NULL is set only AFTER backfill + trigger guarantee every row
--      is filled (session_id is a NOT NULL FK and sessions.company_id is
--      NOT NULL, so every cue resolves a company).

alter table coaching_cues
  add column if not exists company_id uuid
    references companies(id) on delete cascade;

-- Backfill from the parent session (rule lifted, then restored).
drop rule if exists coaching_cues_no_update on coaching_cues;
update coaching_cues c
  set company_id = s.company_id
  from coaching_sessions s
  where c.session_id = s.id
    and c.company_id is null;
create or replace rule coaching_cues_no_update as
  on update to coaching_cues do instead nothing;

-- Auto-fill company_id from the session on insert.
create or replace function coaching_cues_set_company()
returns trigger as $$
begin
  if new.company_id is null then
    select s.company_id into new.company_id
      from coaching_sessions s
      where s.id = new.session_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists coaching_cues_company_trg on coaching_cues;
create trigger coaching_cues_company_trg
  before insert on coaching_cues
  for each row execute function coaching_cues_set_company();

create index if not exists coaching_cues_company_idx
  on coaching_cues (company_id);

-- Every row is now filled (backfill) and stays filled (trigger).
alter table coaching_cues
  alter column company_id set not null;
