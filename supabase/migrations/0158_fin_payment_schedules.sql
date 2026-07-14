-- 0158 — PHASE 2 (remainder): PAYMENT SCHEDULING.
--
-- Spec: FinancialSystem.md §4 Phase 2 — "Payment scheduling and execution".
-- Status before this migration: PARTIAL — execution exists (fin_pay_bill, 0124 + the 0127 row-lock:
-- Dr AP / Cr Cash, partial payments, cumulative over-pay guard). SCHEDULING did not exist at all.
--
-- WHAT THIS ADDS, AND WHAT IT DELIBERATELY DOES NOT (§2.1 / your confirmed model)
-- ──────────────────────────────────────────────────────────────────────────────
-- Your spec's own build-vs-buy flag (PHASE-2-DATA-MODEL "Build-vs-buy flags") says: "Payment execution
-- (actually moving money) — recommend a processor/bank integration (Stripe/ACH); the ledger records the
-- payment, the rails are external." So this migration does NOT move money. It records the INTENT to pay:
-- which bill, how much, on what date. Executing a scheduled payment calls the EXISTING fin_pay_bill —
-- which is already row-locked and over-pay-guarded — so there is exactly ONE posting path to the GL, not
-- a second idiom that could drift from it (§1.5 holistic; §A13 author the space once).
--
-- The schedule is therefore a WORKLIST, not a payment engine. That is the honest scope, and it is the
-- scope your spec asked for.
--
-- MODEL
--   fin_payment_schedules — one row = "pay bill B, amount A, on date D".
--     • status: scheduled → executed | cancelled. Terminal states are reached by the RPCs below.
--     • executing links the resulting fin_payments row, so a scheduled payment is TRACEABLE to the GL
--       entry it produced (§3: "every derived figure must be traceable to its source transactions").
--     • amount numeric(19,4) — §3, never float.
--   fin_payments_due — the view an AP clerk actually works from: scheduled payments due on/before today,
--     plus the outstanding balance so an over-schedule is visible before it is executed.
--
-- CONCURRENCY (§A26 — the row-lock class this codebase already swept: 0127/0132/0152/0153)
--   fin_execute_payment_schedule takes `for update` on the SCHEDULE row before checking its status, so two
--   concurrent executions of the same schedule cannot both pass the status guard and pay twice. The
--   downstream fin_pay_bill takes its own lock on the BILL. Both locks are needed: the schedule lock stops
--   double-execution of the same instruction; the bill lock stops over-payment across instructions.
--
-- Idempotent (§A12). RLS: company-pinned + capability-gated + created_by pinned and frozen (§A23).
--
-- NOT VERIFIED against a live database (no DB access). Acceptance SQL:
-- docs/financial-system/tests/0158_payment_schedules.test.sql. BUILT, not TESTED.

create table if not exists fin_payment_schedules (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references companies(id) on delete cascade,
  bill_id        uuid not null references fin_bills(id) on delete cascade,
  scheduled_date date not null,
  amount         numeric(19,4) not null check (amount > 0),
  status         text not null default 'scheduled'
                   check (status in ('scheduled','executed','cancelled')),
  cash_code      text not null default '1000',        -- which cash account settles it
  note           text,
  payment_id     uuid references fin_payments(id) on delete set null,  -- set on execution → traceability
  executed_at    timestamptz,
  created_by     uuid not null default auth.uid() references auth.users(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists fin_pay_sched_due_idx
  on fin_payment_schedules (company_id, status, scheduled_date);
create index if not exists fin_pay_sched_bill_idx
  on fin_payment_schedules (bill_id);

-- ─── The AP clerk's worklist: what is due, and is it still owed? ──────
create or replace view fin_payments_due with (security_invoker = true) as
select
  s.id, s.company_id, s.bill_id, s.scheduled_date, s.amount, s.status, s.cash_code, s.note,
  b.bill_number, b.vendor_id, v.name as vendor_name, b.currency,
  (select coalesce(sum(l.amount + l.tax_amount), 0) from fin_bill_lines l where l.bill_id = b.id)
    - (select coalesce(sum(p.amount), 0) from fin_payments p where p.bill_id = b.id)
    as outstanding,
  (s.scheduled_date <= current_date) as is_due
from fin_payment_schedules s
join fin_bills b   on b.id = s.bill_id
left join fin_vendors v on v.id = b.vendor_id
where s.status = 'scheduled';

-- ─── Schedule a payment ───────────────────────────────────────────────
create or replace function fin_schedule_payment(
  p_bill_id uuid, p_scheduled_date date, p_amount numeric, p_cash_code text default '1000',
  p_note text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_company uuid; v_status text; v_total numeric(19,4); v_paid numeric(19,4);
        v_sched numeric(19,4); v_id uuid;
begin
  if not fin_can_enter() then raise exception 'Not authorized to schedule payments'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Scheduled amount must be positive'; end if;

  select company_id, status into v_company, v_status from fin_bills where id = p_bill_id for update;
  if v_company is null or v_company <> auth_company_id() then
    raise exception 'Bill not found in your company';
  end if;
  if v_status <> 'approved' then
    raise exception 'Only an approved bill can be scheduled for payment (current: %)', v_status;
  end if;

  -- Do not let the SCHEDULED total exceed what is still owed. Without this, a clerk could queue three
  -- instructions that each pass fin_pay_bill's guard individually but over-commit the bill in aggregate.
  select coalesce(sum(amount + tax_amount), 0) into v_total from fin_bill_lines where bill_id = p_bill_id;
  select coalesce(sum(amount), 0)              into v_paid  from fin_payments   where bill_id = p_bill_id;
  select coalesce(sum(amount), 0)              into v_sched from fin_payment_schedules
    where bill_id = p_bill_id and status = 'scheduled';

  if v_paid + v_sched + p_amount > v_total then
    raise exception 'Scheduling % would exceed the outstanding balance % (already paid %, already scheduled %)',
      p_amount, v_total - v_paid - v_sched, v_paid, v_sched;
  end if;

  insert into fin_payment_schedules (company_id, bill_id, scheduled_date, amount, cash_code, note, created_by)
    values (v_company, p_bill_id, p_scheduled_date, p_amount, coalesce(p_cash_code,'1000'), p_note, auth.uid())
    returning id into v_id;
  return v_id;
end $$;

-- ─── Execute a scheduled payment (posts via the EXISTING pay path) ────
create or replace function fin_execute_payment_schedule(p_schedule_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_company uuid; v_status text; v_bill uuid; v_amount numeric(19,4); v_cash text; v_date date;
        v_payment uuid;
begin
  if not fin_can_approve() then raise exception 'Not authorized to execute payments'; end if;

  -- Lock the SCHEDULE first: two concurrent executions of the same instruction must not both pass the
  -- status guard (§A26 row-lock class — same discipline as 0127/0132/0152/0153).
  select company_id, status, bill_id, amount, cash_code, scheduled_date
    into v_company, v_status, v_bill, v_amount, v_cash, v_date
    from fin_payment_schedules where id = p_schedule_id for update;

  if v_company is null or v_company <> auth_company_id() then
    raise exception 'Payment schedule not found in your company';
  end if;
  if v_status <> 'scheduled' then
    raise exception 'Only a scheduled payment can be executed (current: %)', v_status;
  end if;

  -- The single posting path. fin_pay_bill locks the BILL, re-checks cumulative over-payment, posts
  -- Dr AP / Cr Cash, and marks the bill paid when fully covered. We do not duplicate any of that here.
  v_payment := fin_pay_bill(v_bill, v_amount, current_date, v_cash);

  update fin_payment_schedules
     set status = 'executed', executed_at = now(), payment_id = v_payment
   where id = p_schedule_id;

  return v_payment;
end $$;

-- ─── Cancel ───────────────────────────────────────────────────────────
create or replace function fin_cancel_payment_schedule(p_schedule_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_company uuid; v_status text;
begin
  if not fin_can_enter() then raise exception 'Not authorized to cancel payment schedules'; end if;
  select company_id, status into v_company, v_status
    from fin_payment_schedules where id = p_schedule_id for update;
  if v_company is null or v_company <> auth_company_id() then
    raise exception 'Payment schedule not found in your company';
  end if;
  if v_status <> 'scheduled' then
    raise exception 'Only a scheduled payment can be cancelled (current: %)', v_status;
  end if;
  update fin_payment_schedules set status = 'cancelled' where id = p_schedule_id;
end $$;

-- ─── RLS (mirrors the 0145 finance idiom: company-pinned + capability + author-pinned) ──
alter table fin_payment_schedules enable row level security;

drop policy if exists "fin_pay_sched - select" on fin_payment_schedules;
create policy "fin_pay_sched - select" on fin_payment_schedules
  for select using (company_id = auth_company_id() and fin_can_view());

drop policy if exists "fin_pay_sched - insert" on fin_payment_schedules;
create policy "fin_pay_sched - insert" on fin_payment_schedules
  for insert with check (company_id = auth_company_id() and fin_can_enter() and created_by = auth.uid());

drop policy if exists "fin_pay_sched - update" on fin_payment_schedules;
create policy "fin_pay_sched - update" on fin_payment_schedules
  for update using (company_id = auth_company_id() and fin_can_enter())
  with check (company_id = auth_company_id() and fin_can_enter());

drop policy if exists "fin_pay_sched - delete" on fin_payment_schedules;
create policy "fin_pay_sched - delete" on fin_payment_schedules
  for delete using (company_id = auth_company_id() and fin_can_configure());

-- Author pinned + frozen (§A23: created_by is attribution — it must not be rewritable after the fact).
drop trigger if exists fin_freeze_creator on fin_payment_schedules;
create trigger fin_freeze_creator before update on fin_payment_schedules
  for each row execute function fin_freeze_created_by();

-- Immutable audit trail (§3) — same generic audit trigger every other fin_ table carries.
drop trigger if exists fin_audit_trg on fin_payment_schedules;
create trigger fin_audit_trg after insert or update or delete on fin_payment_schedules
  for each row execute function fin_audit();
