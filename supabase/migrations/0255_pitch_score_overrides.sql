-- 0255 — manager overrides on a Pitch Score, logged
--
-- SPECIFIED, not invented. The rubric's implementation notes (page 7):
--
--   "Manager override: managers can adjust any bonus or violation, with the change logged."
--
-- The founder widened it on 2026-09-21 to element GRADES as well, which is a superset — a
-- manager who listens back and hears the rep make a point the scorer marked Missed has the same
-- claim to correct it as one who hears a bonus the scorer did not award.
--
-- WHY THIS EXISTS AT ALL. The dispute loop shipped without it and the gap was immediate: the most
-- common real dispute is one a manager AGREES with, and until now the only response was words.
-- "You're right" followed by a score that does not move teaches a rep that disputing is
-- theatre, and a rep who stops disputing takes the scorer's only correction signal with them.
--
-- APPEND-ONLY, and the whole design follows from it (§3.1). An override is a fact about what
-- somebody did, at a time, with a reason. It is never edited and never deleted: a second override
-- of the same item supersedes the first by being later, and BOTH stay on the record. "The change
-- is logged" is only true if the log cannot be rewritten.
--
-- The pitch's own totals ARE updated, because the leaderboard sums them and a board that had to
-- replay every override on every read would be both slow and a second place for the arithmetic to
-- live (§2.2). The stored total is the verdict; these rows are why it says what it says.

create table if not exists pitch_score_overrides (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade,
  pitch_id     uuid not null references pitch_scores(id) on delete cascade,

  -- Which vocabulary the item belongs to. Element grades and bonus/violation awards are corrected
  -- differently — one changes a grade, the other changes whether points were given — so the type
  -- decides how the recompute treats it rather than being inferred from the id's prefix.
  item_type    text not null check (item_type in ('element', 'bonus', 'violation')),
  item_id      text not null,

  -- For an element: the old/new grade ('hit' | 'partial' | 'missed').
  -- For a bonus or violation: 'awarded' | 'removed'.
  -- Text rather than an enum so a rubric revision does not need a type migration to add a grade.
  old_value    text,
  new_value    text not null,

  -- Points before and after, so the row explains the total on its own. Stored rather than derived
  -- because the rubric version that produced them may be retired by the time anyone reads this.
  old_points   numeric(4,1),
  new_points   numeric(4,1),

  -- REQUIRED. An override with no reason is indistinguishable from a manager fixing a number they
  -- did not like, which is precisely what an audit trail exists to rule out. The rep can read it.
  reason       text not null check (length(btrim(reason)) > 0),

  actor_id     uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now()
);

create index if not exists pitch_score_overrides_pitch_idx
  on pitch_score_overrides (pitch_id, created_at desc);
create index if not exists pitch_score_overrides_company_idx
  on pitch_score_overrides (company_id, created_at desc);

-- Tenant guard, mirroring the one 0252 puts on the other child tables: company_id is passed in by
-- the writer, so nothing but a trigger stops a row being filed against the wrong company.
create or replace function pitch_score_override_company_matches()
returns trigger language plpgsql as $fn$
begin
  if not exists (
    select 1 from pitch_scores p
    where p.id = new.pitch_id and p.company_id = new.company_id
  ) then
    raise exception 'pitch_score_overrides.company_id must match its pitch_scores row';
  end if;
  return new;
end;
$fn$;

drop trigger if exists pitch_score_overrides_company_check on pitch_score_overrides;
create trigger pitch_score_overrides_company_check
  before insert or update on pitch_score_overrides
  for each row execute function pitch_score_override_company_matches();

alter table pitch_score_overrides enable row level security;

-- READ: the rep whose score it is, or a manager in the same company. A rep MUST be able to read
-- these — an override they cannot see is a silent correction, which is the thing the logging
-- requirement exists to prevent.
drop policy if exists "pitch_score_overrides - select" on pitch_score_overrides;
create policy "pitch_score_overrides - select" on pitch_score_overrides
  for select using (
    exists (
      select 1 from pitch_scores p
      where p.id = pitch_score_overrides.pitch_id
        and p.company_id = auth_company_id()
        and (p.rep_id = auth.uid() or is_sales_coach_manager())
    )
  );

-- No insert / update / delete policy, deliberately. Overrides are written by the override RPC
-- with the service role, which is what enforces manager-only and recomputes the total in the same
-- transaction. A client-writable override table is a rep editing their own score.
