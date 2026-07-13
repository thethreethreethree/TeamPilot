-- 0159 — PHASE 2 (remainder): DUNNING / COLLECTIONS WORKFLOW.
--
-- Spec: FinancialSystem.md §4 Phase 2 — "Dunning / collections workflow".
-- Status before this migration: PARTIAL — a collections WORKLIST exists (overdue invoices via the AR
-- aging views + /api/finance/ar/collections). What did NOT exist is the WORKFLOW: escalating stages, and
-- a record of what chase action was actually taken, when, and by whom.
--
-- WHY THE HISTORY IS APPEND-ONLY (§3.1, and spec §3 "all financial records are append-only")
-- ─────────────────────────────────────────────────────────────────────────────────────────
-- A dunning event is a claim about the outside world: "we sent this customer a reminder on this date."
-- If that row can be edited or deleted, it stops being evidence. Collections disputes ("you never told
-- us") are exactly the case where the record must be trustworthy. So fin_dunning_events is append-only,
-- enforced by a RULE (do instead nothing) — which, unlike RLS, binds SERVICE-ROLE and direct SQL too.
-- This mirrors the pattern the §3.1 chain tables already use in this codebase; it is not a new idiom
-- (§A28: the precedent decides it).
--
-- WHAT THIS DOES NOT DO
-- It does not SEND anything. Sending (email/SMS) is a delivery concern with its own provider; recording
-- that a stage was reached and an action was taken is the ledger's concern. fin_record_dunning_action is
-- called BY whatever does the sending. Claiming otherwise would be an A27 false guarantee — a label
-- promising a send the write path never performs.
--
-- MODEL
--   fin_dunning_policies — the escalation ladder: at N days overdue, the invoice is at stage S.
--                          Effective-dated per company; ordered by days_overdue.
--   fin_dunning_events   — APPEND-ONLY. One row = one chase action actually taken on one invoice.
--   fin_dunning_worklist — the view a collections clerk works from: every overdue invoice, its days
--                          overdue, the stage it has REACHED per the ladder, the last action taken, and
--                          whether it is due for the next stage.
--
-- Idempotent (§A12). RLS company-pinned + capability-gated (§A23).
-- NOT VERIFIED against a live database. Acceptance: tests/0159_dunning.test.sql. BUILT, not TESTED.

-- ─── The escalation ladder ────────────────────────────────────────────
create table if not exists fin_dunning_policies (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  stage         int  not null check (stage >= 1),           -- 1 = gentle reminder, 2 = firm, 3 = final…
  days_overdue  int  not null check (days_overdue >= 0),    -- reached at/after this many days past due
  label         text not null,                              -- "Reminder", "Second notice", "Final notice"
  channel       text not null default 'email' check (channel in ('email','phone','letter','other')),
  is_active     boolean not null default true,
  created_by    uuid not null default auth.uid() references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint fin_dunning_stage_uq  unique (company_id, stage),
  constraint fin_dunning_days_uq   unique (company_id, days_overdue)
);
create index if not exists fin_dunning_pol_idx
  on fin_dunning_policies (company_id, is_active, days_overdue);

-- ─── The chase record — APPEND-ONLY ───────────────────────────────────
create table if not exists fin_dunning_events (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade,
  invoice_id   uuid not null references fin_invoices(id) on delete cascade,
  stage        int  not null check (stage >= 1),
  channel      text not null default 'email' check (channel in ('email','phone','letter','other')),
  note         text,
  days_overdue int,                                    -- snapshot at the moment of the action
  actor        uuid not null default auth.uid() references auth.users(id) on delete set null,
  acted_at     timestamptz not null default now()
);
create index if not exists fin_dunning_ev_inv_idx
  on fin_dunning_events (invoice_id, acted_at desc);

-- Append-only: a chase record is evidence. Rules (unlike RLS) bind service-role and direct SQL too.
create or replace rule fin_dunning_events_no_update as
  on update to fin_dunning_events do instead nothing;
create or replace rule fin_dunning_events_no_delete as
  on delete to fin_dunning_events do instead nothing;

-- ─── The collections worklist ─────────────────────────────────────────
-- Reuses the outstanding computation the AR side already defines (invoice total − receipts − credits),
-- so the number a clerk chases is the SAME number the ledger reports. One definition, not two (§A13).
create or replace view fin_dunning_worklist as
with outstanding as (
  select
    i.id, i.company_id, i.invoice_number, i.customer_id, i.due_date, i.currency, i.status,
    (select coalesce(sum(l.amount + l.tax_amount), 0) from fin_invoice_lines l where l.invoice_id = i.id)
      - (select coalesce(sum(r.amount), 0) from fin_receipts r where r.invoice_id = i.id)
      - (select coalesce(sum(cl.amount + cl.tax_amount), 0)
           from fin_credit_note_lines cl
           join fin_credit_notes cn on cn.id = cl.credit_note_id
          where cn.invoice_id = i.id and cn.status = 'issued')
      as outstanding
  from fin_invoices i
  -- fin_invoices.status is check (status in ('draft','sent','paid','void')) — VERIFIED against 0131,
  -- not assumed. 'sent' is the issued-and-not-yet-fully-settled state: fin_record_receipt (0132) only
  -- flips an invoice to 'paid' once cumulative receipts cover the total, so a PARTLY-paid invoice is
  -- still 'sent'. Filtering on 'sent' therefore covers issued + partly-paid, and the outstanding > 0
  -- predicate below excludes anything actually settled.
  -- (An earlier draft of this view filtered on 'issued'/'partly_paid'/'overdue' — values that do not
  --  exist in the check constraint — which would have matched ZERO rows and shipped a permanently
  --  empty collections worklist. Caught by reading the constraint instead of trusting the vocabulary.)
  where i.status = 'sent'
)
select
  o.id as invoice_id, o.company_id, o.invoice_number, o.customer_id, c.name as customer_name,
  o.due_date, o.currency, o.outstanding,
  greatest(0, (current_date - o.due_date))::int as days_overdue,
  -- the stage the ladder says this invoice has REACHED
  (select max(p.stage) from fin_dunning_policies p
    where p.company_id = o.company_id and p.is_active
      and (current_date - o.due_date) >= p.days_overdue) as stage_due,
  -- the highest stage we have ACTUALLY actioned
  (select max(e.stage) from fin_dunning_events e where e.invoice_id = o.id) as stage_actioned,
  (select max(e.acted_at) from fin_dunning_events e where e.invoice_id = o.id) as last_action_at
from outstanding o
left join fin_customers c on c.id = o.customer_id
where o.outstanding > 0 and o.due_date < current_date;

-- ─── Record a chase action ────────────────────────────────────────────
create or replace function fin_record_dunning_action(
  p_invoice_id uuid, p_stage int, p_channel text default 'email', p_note text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_company uuid; v_due date; v_id uuid;
begin
  if not fin_can_enter() then raise exception 'Not authorized to record collections actions'; end if;
  select company_id, due_date into v_company, v_due from fin_invoices where id = p_invoice_id;
  if v_company is null or v_company <> auth_company_id() then
    raise exception 'Invoice not found in your company';
  end if;
  if p_stage is null or p_stage < 1 then raise exception 'Dunning stage must be >= 1'; end if;

  insert into fin_dunning_events (company_id, invoice_id, stage, channel, note, days_overdue, actor)
    values (v_company, p_invoice_id, p_stage, coalesce(p_channel,'email'), p_note,
            greatest(0, (current_date - v_due))::int, auth.uid())
    returning id into v_id;
  return v_id;
end $$;

-- ─── RLS ──────────────────────────────────────────────────────────────
alter table fin_dunning_policies enable row level security;
alter table fin_dunning_events   enable row level security;

drop policy if exists "fin_dunning_pol - select" on fin_dunning_policies;
create policy "fin_dunning_pol - select" on fin_dunning_policies
  for select using (company_id = auth_company_id() and fin_can_view());
drop policy if exists "fin_dunning_pol - insert" on fin_dunning_policies;
create policy "fin_dunning_pol - insert" on fin_dunning_policies
  for insert with check (company_id = auth_company_id() and fin_can_configure() and created_by = auth.uid());
drop policy if exists "fin_dunning_pol - update" on fin_dunning_policies;
create policy "fin_dunning_pol - update" on fin_dunning_policies
  for update using (company_id = auth_company_id() and fin_can_configure())
  with check (company_id = auth_company_id() and fin_can_configure());
drop policy if exists "fin_dunning_pol - delete" on fin_dunning_policies;
create policy "fin_dunning_pol - delete" on fin_dunning_policies
  for delete using (company_id = auth_company_id() and fin_can_configure());

-- Events: readable by the company; written ONLY through the DEFINER RPC (no direct client insert path),
-- and never updated/deleted (the rules above enforce that even against service-role).
drop policy if exists "fin_dunning_ev - select" on fin_dunning_events;
create policy "fin_dunning_ev - select" on fin_dunning_events
  for select using (company_id = auth_company_id() and fin_can_view());

drop trigger if exists fin_freeze_creator on fin_dunning_policies;
create trigger fin_freeze_creator before update on fin_dunning_policies
  for each row execute function fin_freeze_created_by();

drop trigger if exists fin_audit_trg on fin_dunning_policies;
create trigger fin_audit_trg after insert or update or delete on fin_dunning_policies
  for each row execute function fin_audit();
