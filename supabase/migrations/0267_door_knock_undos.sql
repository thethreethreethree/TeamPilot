-- 0267_door_knock_undos.sql
--
-- A QUIET UNDO FOR A MIS-TAPPED DOOR (founder, 2026-09-29).
--
-- REV 1 removed "Undo last" from the Door Log on 2026-09-11. That left a rep who taps "Sold" by accident,
-- between houses and in a hurry, with no way to take it back anywhere — the app's own comment in
-- door-home-page.tsx says so. The founder chose, in a picker: "a quiet 'undo' for a few seconds" after each
-- tap, not the permanent button REV 1 removed.
--
-- APPEND-ONLY (CLAUDE.md §3.1). `door_knocks` has select and insert policies and NO update or delete policy —
-- a knock is a fact about what happened and is never edited. So an undo does not touch the knock. It APPENDS
-- a row here saying "this knock was taken back", and every COUNT reads `door_knocks_live`, which is
-- `door_knocks` minus the undone ones. The knock and its undo both remain on the record.
--
-- ONE DEFINITION OF "A KNOCK THAT COUNTS" (§2.2). Counting readers go through `door_knocks_live`; the
-- `rep_kpi_daily` view is redefined over it below, which carries its five existing readers along unchanged.
-- Readers that join a PITCH to its knock are deliberately NOT switched: a pitch cannot be recorded inside
-- the few-second undo window, and the knock's outcome remains true of the pitch.
--
-- THE WINDOW. The button shows for about five seconds; the server accepts an undo for 60 minutes after the
-- knock was stored, so an undo sent from a phone that lost signal for a moment still lands. Beyond that,
-- history cannot be rewritten from the rep's side.
--
-- Re-runnable by construction (A12): if-not-exists, drop-policy-if-exists, create-or-replace.

create table if not exists door_knock_undos (
  knock_id   uuid primary key references door_knocks(id) on delete cascade,  -- one undo per knock
  company_id uuid not null,
  rep_id     uuid not null references auth.users(id) on delete cascade,
  undone_at  timestamptz not null default now()
);

alter table door_knock_undos enable row level security;

-- Visible to exactly whoever can already see the knock: the same expression as "door_knocks - select"
-- as last redefined in 0265 (the rep, or a company admin / Sales Coach admin).
drop policy if exists "door_knock_undos - select" on door_knock_undos;
create policy "door_knock_undos - select" on door_knock_undos for select using (
  rep_id = auth.uid()
  or exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and p.company_id = door_knock_undos.company_id
      and (p.role = any (admin_roles()) or p.sales_coach_role = 'admin')
  )
);

-- A rep may undo only their OWN knock, in their own company, within 60 minutes of it being stored.
drop policy if exists "door_knock_undos - insert" on door_knock_undos;
create policy "door_knock_undos - insert" on door_knock_undos for insert with check (
  rep_id = auth.uid()
  and company_id = auth_company_id()
  and exists (
    select 1 from door_knocks k
    where k.id = door_knock_undos.knock_id
      and k.rep_id = auth.uid()
      and k.company_id = door_knock_undos.company_id
      and k.created_at > now() - interval '60 minutes'
  )
);
-- No update policy and no delete policy: an undo is itself a fact, and is not taken back.

-- The knocks that count. Runs as the QUERYING user, so door_knocks' RLS applies through it (the 2026-07-14
-- lesson: a view without security_invoker reads every company's rows).
create or replace view door_knocks_live with (security_invoker = true) as
  select k.*
  from door_knocks k
  where not exists (select 1 from door_knock_undos u where u.knock_id = k.id);

-- Same columns and grouping as 0215; only the source changes, so its five readers exclude undone knocks
-- without being edited.
create or replace view rep_kpi_daily with (security_invoker = true) as
  select company_id, rep_id, local_date,
         count(*)                                                as doors_knocked,
         count(*) filter (where outcome = 'sold')                as sold,
         count(*) filter (where outcome = 'go_back')             as go_backs,
         count(*) filter (where outcome = 'not_interested')      as not_interested,
         count(*) filter (where outcome = 'no_answer')           as no_answer,
         count(*) filter (where outcome = 'non_decision_maker')  as non_decision_maker
  from door_knocks_live group by company_id, rep_id, local_date;
