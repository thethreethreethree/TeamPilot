-- 0172 — PHASE 6: SCHEDULED REPORT DELIVERY.
--
-- ── WHAT THIS FEATURE ACTUALLY IS ─────────────────────────────────────────────────────────────
--
-- It is not "email a report on a cron". It is a STANDING INSTRUCTION TO EXFILTRATE FINANCIAL DATA, set up
-- once and then executed forever by a machine with nobody watching. Every other read path in this system
-- has a human on the end of it who is, at that moment, authenticated. This one does not.
--
-- That changes what the safety properties have to be:
--
-- 1. THE RECIPIENT MUST BE A MEMBER OF THE COMPANY — a user_id, never a free-text email address.
--    An `email text` column here would let anyone who can create a schedule send the company's P&L to
--    any address on earth, on a recurring basis, with a legitimate-looking audit trail. It would not even
--    look like an attack; it would look like a report subscription. So the recipient is a foreign key into
--    profiles, and the tenant is checked. You cannot address what you cannot name.
--
-- 2. AUTHORITY IS RE-CHECKED AT SEND TIME, NEVER AT SETUP TIME.
--    This is the same lesson as 0168's delegation, and it is load-bearing for the same reason. A schedule
--    created in March by a controller, to a recipient who leaves the company in June, will still be firing
--    in December — mailing the general ledger to a former employee's inbox every month. The check must ask
--    "may this person see this TODAY?", not "could they see it when someone set this up?". A permission is
--    a POINTER, never a snapshot.
--
-- 3. A FAILED SEND MUST BE LOUD.
--    A delivery that silently stops is worse than one that never existed: the recipient believes no news is
--    good news, and quietly stops looking at the numbers they were relying on. So every run is recorded —
--    success AND failure — and the failures are queryable.
--
-- This migration owns the SCHEDULE and its RUN LOG. It does not send mail; the delivery worker is app-side
-- and reads fin_report_schedules_due. That boundary is deliberate: the database decides WHO MAY RECEIVE
-- WHAT, and it decides that at the moment of sending. The worker only carries.
--
-- Idempotent (§A12). NOT VERIFIED against a live database. BUILT, not TESTED.

create table if not exists fin_report_schedules (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade,
  report_id    uuid not null references fin_report_definitions(id) on delete cascade,

  -- A MEMBER, not an email address. See note 1 above — this single choice is what stops this feature from
  -- being a recurring data-exfiltration primitive with a clean audit trail.
  recipient_id uuid not null references auth.users(id) on delete cascade,

  cadence      text not null check (cadence in ('weekly','monthly','quarterly')),
  next_run_on  date not null,
  is_active    boolean not null default true,
  created_by   uuid not null default auth.uid() references auth.users(id),
  created_at   timestamptz not null default now(),

  -- One standing instruction per report per recipient. Two identical schedules would double-send and
  -- teach the recipient to ignore the mail.
  constraint fin_report_sched_uq unique (report_id, recipient_id)
);
create index if not exists fin_report_sched_due_idx
  on fin_report_schedules (next_run_on) where is_active;

-- ─── The run log. Append-only: a delivery either happened or it did not. ──
create table if not exists fin_report_deliveries (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  schedule_id uuid not null references fin_report_schedules(id) on delete cascade,
  ran_at      timestamptz not null default now(),
  status      text not null check (status in ('sent','skipped_no_access','failed')),
  detail      text,
  row_count   int
);
create index if not exists fin_report_deliv_sched_idx on fin_report_deliveries (schedule_id, ran_at desc);

-- Append-only. A rule (not just RLS) so it binds the service role and direct SQL too — the delivery worker
-- runs as the service role, and it must not be able to erase a failure it caused.
create or replace rule fin_report_deliv_no_update as
  on update to fin_report_deliveries do instead nothing;
create or replace rule fin_report_deliv_no_delete as
  on delete to fin_report_deliveries do instead nothing;

-- ─── What is due, and MAY the recipient still see it? ─────────────────
-- THE AUTHORITY CHECK LIVES HERE, IN THE DUE-LIST ITSELF — not in the worker, and not at setup time.
-- A schedule whose recipient has left the company, or lost finance access, simply stops appearing as due.
-- The worker cannot send what it is not told about, so a bug in the worker cannot leak the ledger to a
-- former employee: the database never hands it the address.
create or replace view fin_report_schedules_due with (security_invoker = true) as
  select s.id            as schedule_id,
         s.company_id,
         s.report_id,
         s.recipient_id,
         s.cadence,
         s.next_run_on,
         r.name          as report_name
    from fin_report_schedules s
    join fin_report_definitions r on r.id = s.report_id
    join profiles p on p.id = s.recipient_id
   where s.is_active
     and s.next_run_on <= current_date
     -- Re-checked AT SEND TIME, every time:
     and p.company_id = s.company_id       -- still in this company
     and p.status     = 'active'           -- still an active member (not removed)
     and exists (                          -- still holds finance access
       select 1 from fin_roles fr
        where fr.company_id = s.company_id and fr.user_id = s.recipient_id
     );

-- ─── Advance the schedule after a run ─────────────────────────────────
-- Called by the worker with the outcome. Records the run FIRST (including a failure), then advances — so a
-- send that failed still moves on rather than retrying forever, and the failure is on the record.
create or replace function fin_record_report_delivery(
  p_schedule uuid, p_status text, p_detail text default null, p_rows int default null
) returns void
language plpgsql security definer set search_path = public as $$
declare v_co uuid; v_cad text; v_next date;
begin
  select company_id, cadence, next_run_on into v_co, v_cad, v_next
    from fin_report_schedules where id = p_schedule for update;
  if v_co is null then
    raise exception 'Schedule not found';
  end if;

  insert into fin_report_deliveries (company_id, schedule_id, status, detail, row_count)
    values (v_co, p_schedule, p_status, p_detail, p_rows);

  -- Advance from the SCHEDULED date, not from today. Advancing from today would let a worker that ran late
  -- silently drift the whole schedule — a monthly report that runs a day late every month walks itself out
  -- of the month it is supposed to cover.
  update fin_report_schedules
     set next_run_on = case v_cad
                         when 'weekly'    then v_next + 7
                         when 'monthly'   then (v_next + interval '1 month')::date
                         when 'quarterly' then (v_next + interval '3 months')::date
                       end
   where id = p_schedule;
end $$;

-- ─── Deliveries that FAILED, so a silent stop cannot hide ─────────────
create or replace view fin_report_delivery_failures with (security_invoker = true) as
  select d.company_id, d.schedule_id, r.name as report_name, s.recipient_id,
         d.ran_at, d.status, d.detail
    from fin_report_deliveries d
    join fin_report_schedules   s on s.id = d.schedule_id
    join fin_report_definitions r on r.id = s.report_id
   where d.status <> 'sent'
   order by d.ran_at desc;

-- ─── RLS ──────────────────────────────────────────────────────────────
alter table fin_report_schedules  enable row level security;
alter table fin_report_deliveries enable row level security;

drop policy if exists "fin_sched - select" on fin_report_schedules;
create policy "fin_sched - select" on fin_report_schedules
  for select using (company_id = auth_company_id() and fin_can_view());

-- The RECIPIENT must be someone who can already see finance. Creating a schedule must not be a way to
-- grant a view that the recipient does not otherwise have.
drop policy if exists "fin_sched - insert" on fin_report_schedules;
create policy "fin_sched - insert" on fin_report_schedules
  for insert with check (
    company_id = auth_company_id()
    and fin_can_view()
    and created_by = auth.uid()                                    -- §A23: pin the author
    and exists (select 1 from profiles p
                 where p.id = recipient_id and p.company_id = auth_company_id())
    and exists (select 1 from fin_roles fr
                 where fr.company_id = auth_company_id() and fr.user_id = recipient_id)
  );

drop policy if exists "fin_sched - update" on fin_report_schedules;
create policy "fin_sched - update" on fin_report_schedules
  for update using (
    company_id = auth_company_id() and (created_by = auth.uid() or fin_can_configure())
  ) with check (
    company_id = auth_company_id() and (created_by = auth.uid() or fin_can_configure())
  );

drop policy if exists "fin_sched - delete" on fin_report_schedules;
create policy "fin_sched - delete" on fin_report_schedules
  for delete using (
    company_id = auth_company_id() and (created_by = auth.uid() or fin_can_configure())
  );

drop policy if exists "fin_deliv - select" on fin_report_deliveries;
create policy "fin_deliv - select" on fin_report_deliveries
  for select using (company_id = auth_company_id() and fin_can_view());
-- Writes come from the worker via the DEFINER RPC only. No client-side insert policy: a client that could
-- write the log could forge a 'sent' for a delivery that never happened.

-- §A23: freeze the tenant, the author, and — critically — THE RECIPIENT. Without freezing the recipient,
-- an update could re-point an existing, already-approved schedule at a different person, inheriting its
-- legitimacy. Change of recipient must mean delete-and-recreate, which re-runs the INSERT check above.
create or replace function fin_sched_freeze() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.company_id   := old.company_id;
  new.created_by   := old.created_by;
  new.recipient_id := old.recipient_id;
  new.report_id    := old.report_id;
  return new;
end $$;
drop trigger if exists fin_sched_freeze_trg on fin_report_schedules;
create trigger fin_sched_freeze_trg before update on fin_report_schedules
  for each row execute function fin_sched_freeze();
