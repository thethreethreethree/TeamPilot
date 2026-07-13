-- 0169 — PHASE 9: OPENING BALANCE IMPORT (the day-one migration off the old system).
--
-- Built against the CONFIRMED Phase-9 model (docs/financial-system/PHASE-9-DATA-MODEL.md §4).
--
-- WITHOUT THIS, NOTHING ELSE IN THE LEDGER IS USABLE BY A REAL COMPANY.
-- Every feature built in Phases 1–8 assumes the books start somewhere. A company that has been trading for
-- six years does not start at zero: it starts with cash in the bank, invoices unpaid, bills owed, and
-- equity. Until those balances can be carried in, this system can only ever serve a company founded on the
-- day it installed us — which is nobody. This is the bridge from "the software works" to "we can use it".
--
-- ── THE ONE RULE THIS MIGRATION EXISTS TO HONOUR (§3.4, and the proposal review caught it) ────
--
-- A trial balance from an old system OFTEN DOES NOT BALANCE. Rounding, a mid-year account change, a
-- half-migrated subledger, a column the bookkeeper hand-typed. That imbalance is the single most valuable
-- fact in the whole import — it is the difference between the books you HAVE and the books you THINK you
-- have, and it is the last moment anyone will ever be in a position to find it.
--
-- The tempting design is to make it balance: post the difference to equity and hand the user a clean,
-- green, balanced opening position. That entry WOULD balance. Every downstream check — the balance
-- assertion, the trial balance, the balance sheet — would pass forever. And the company would be running
-- on a fabricated financial position, with the error buried in equity where no one will ever look again.
--
-- So: the contra goes to OPENING BALANCE EQUITY (3900), and the residual left sitting in that account IS
-- the imbalance, by construction, named and visible. We do not plug it. We do not absorb it. We SURFACE it
-- and refuse to call the migration finished until a human has looked at it.
--
--   Opening Balance Equity <> 0  ⇒  your old trial balance did not balance, by exactly this much.
--
-- That account is not an accounting trick; it is a QUESTION the system refuses to answer on the user's
-- behalf. It stays on the balance sheet, in their face, until they resolve it. This is the same discipline
-- as the cash-flow 'unclassified' bucket (0164) and payroll's refusal to derive a missing figure (0167):
-- the system will not manufacture a number it does not have.
--
-- ── WHY THE ENTRY ITSELF STILL BALANCES ───────────────────────────────────────────────────────
-- Debits and credits of the opening entry balance BY CONSTRUCTION, because OBE takes whatever residual is
-- needed. That is not a plug — the plug would be SILENT. Here the residual has a name, an account, a
-- balance-sheet line, and a warning attached to it. The entry is balanced AND the error is preserved.
--
-- Idempotent (§A12). NOT VERIFIED against a live database. BUILT, not TESTED.

-- ─── Opening Balance Equity account ───────────────────────────────────
-- Seeded on demand rather than added to the COA seed, so existing companies get it too.
create or replace function fin_obe_account(p_company uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from fin_accounts where company_id = p_company and code = '3900';
  if v_id is null then
    insert into fin_accounts (company_id, code, name, type, normal_balance, is_system)
      values (p_company, '3900', 'Opening Balance Equity', 'equity', 'credit', true)
      returning id into v_id;
  end if;
  return v_id;
end $$;

-- ─── The staged trial balance ─────────────────────────────────────────
-- Staged first, posted second. The user must SEE what they are about to commit — and see the imbalance —
-- before a single line hits the ledger. An import that posted on upload would deny them that look.
create table if not exists fin_opening_batches (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade,
  as_of        date not null,                       -- the migration date: balances are as at close of this day
  source       text,                                -- "Xero export 2026-06-30" — where these numbers came from
  status       text not null default 'draft' check (status in ('draft','posted')),
  entry_id     uuid references fin_journal_entries(id),     -- the posted opening entry, once posted
  created_by   uuid not null default auth.uid() references auth.users(id),
  created_at   timestamptz not null default now(),
  posted_at    timestamptz
);

create table if not exists fin_opening_lines (
  id         uuid primary key default gen_random_uuid(),
  batch_id   uuid not null references fin_opening_batches(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  account_id uuid not null references fin_accounts(id),
  debit      numeric(19,4) not null default 0 check (debit  >= 0),
  credit     numeric(19,4) not null default 0 check (credit >= 0),
  -- A line is a debit or a credit, never both and never neither. Same rule as the ledger itself (0118) —
  -- an import is not a place to relax the invariants the ledger depends on.
  constraint fin_opening_line_xor_ck check ((debit > 0 and credit = 0) or (credit > 0 and debit = 0)),
  -- One row per account. A trial balance with the same account twice is a malformed source, not a sum to
  -- quietly perform on the user's behalf.
  unique (batch_id, account_id)
);
create index if not exists fin_opening_lines_batch_idx on fin_opening_lines (batch_id);

-- ─── What the user must look at before posting ────────────────────────
-- THE RESIDUAL IS THE POINT OF THIS VIEW. It is computed, named, and shown — never absorbed.
create or replace view fin_opening_summary as
  select b.id            as batch_id,
         b.company_id,
         b.as_of,
         b.status,
         count(l.id)                              as line_count,
         coalesce(sum(l.debit), 0)                as total_debits,
         coalesce(sum(l.credit), 0)               as total_credits,
         -- The imbalance in the SOURCE trial balance. Non-zero means the old books did not balance.
         -- This exact figure is what will land in Opening Balance Equity, where it stays visible.
         coalesce(sum(l.debit), 0) - coalesce(sum(l.credit), 0) as imbalance
    from fin_opening_batches b
    left join fin_opening_lines l on l.batch_id = b.id
   group by b.id, b.company_id, b.as_of, b.status;

-- ─── Post the opening entry ───────────────────────────────────────────
create or replace function fin_post_opening_batch(p_batch uuid, p_period uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_company uuid; v_status text; v_as_of date;
  v_debits numeric(19,4); v_credits numeric(19,4); v_residual numeric(19,4);
  v_obe uuid; v_entry uuid;
  v_lines jsonb;
  v_existing int;
begin
  -- Row lock: posting an opening batch twice would double every balance in the company. The read-check-
  -- write must be serialized (0127/0152 precedent) — two clicks on a slow connection is all it takes.
  select company_id, status, as_of into v_company, v_status, v_as_of
    from fin_opening_batches where id = p_batch for update;

  if v_company is null or v_company <> auth_company_id() then
    raise exception 'Opening batch not found in your company';
  end if;
  if not fin_can_configure() then
    raise exception 'Only a controller or CFO may post opening balances';
  end if;
  if v_status = 'posted' then
    raise exception 'These opening balances have already been posted';
  end if;

  -- Opening balances must be the FIRST thing in the books. Posting them after trading has begun would
  -- silently restate a period people have already reported on and acted upon. Refuse; do not "merge".
  select count(*) into v_existing
    from fin_journal_entries e
   where e.company_id = v_company and e.status = 'posted' and e.entry_date < v_as_of;
  if v_existing > 0 then
    raise exception 'There is already posted activity before %. Opening balances must precede all activity — they cannot be layered underneath a ledger that is already in use.', v_as_of;
  end if;

  select coalesce(sum(debit), 0), coalesce(sum(credit), 0)
    into v_debits, v_credits
    from fin_opening_lines where batch_id = p_batch;

  if v_debits = 0 and v_credits = 0 then
    raise exception 'This batch has no balances to post';
  end if;

  -- THE RESIDUAL. If the source trial balance did not balance, this is by how much — and it is about to
  -- become a NAMED, VISIBLE line in equity, not a silent correction.
  v_residual := v_debits - v_credits;
  v_obe := fin_obe_account(v_company);

  -- Build the entry: every account's balance as given, plus OBE taking the residual on the opposite side.
  -- Sum of debits now equals sum of credits BY CONSTRUCTION — the entry balances, and the error survives.
  select jsonb_agg(
           jsonb_build_object('account_id', l.account_id, 'debit', l.debit, 'credit', l.credit,
                              'memo', 'Opening balance')
         )
    into v_lines
    from fin_opening_lines l where l.batch_id = p_batch;

  if v_residual <> 0 then
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'account_id', v_obe,
      -- Debits exceed credits ⇒ OBE is credited by the difference, and vice versa.
      'debit',  case when v_residual < 0 then -v_residual else 0 end,
      'credit', case when v_residual > 0 then  v_residual else 0 end,
      'memo', 'Opening Balance Equity — unreconciled difference from the source trial balance'
    ));
  end if;

  -- Argument order verified against 0122/0147: (company, entry_date, period_id, description, source, lines).
  v_entry := fin_post_system_entry(
    v_company, v_as_of, p_period,
    'Opening balances as at ' || v_as_of::text,
    'opening_batch:' || p_batch::text,
    v_lines
  );

  update fin_opening_batches
     set status = 'posted', entry_id = v_entry, posted_at = now()
   where id = p_batch;

  return v_entry;
end $$;

-- ─── Is there an unresolved opening imbalance RIGHT NOW? ──────────────
-- Read from the LEDGER, not from the batch: the user may have since posted a correcting entry to clear
-- OBE, and this must reflect that. The question is "does Opening Balance Equity still carry a balance?",
-- not "was the import imbalanced?" — those stop being the same question the moment someone fixes it.
create or replace view fin_opening_imbalance as
  select a.company_id,
         coalesce(sum(l.credit) - sum(l.debit), 0) as obe_balance
    from fin_accounts a
    left join fin_journal_lines l   on l.account_id = a.id
    left join fin_journal_entries e on e.id = l.entry_id and e.status = 'posted'
   where a.code = '3900'
   group by a.company_id;

-- ─── RLS ──────────────────────────────────────────────────────────────
alter table fin_opening_batches enable row level security;
alter table fin_opening_lines   enable row level security;

drop policy if exists "fin_open_batch - select" on fin_opening_batches;
create policy "fin_open_batch - select" on fin_opening_batches
  for select using (company_id = auth_company_id() and fin_can_view());

-- Configure-level: opening balances define the entire financial position of the company. This is not an
-- entry-level act.
drop policy if exists "fin_open_batch - insert" on fin_opening_batches;
create policy "fin_open_batch - insert" on fin_opening_batches
  for insert with check (
    company_id = auth_company_id() and fin_can_configure() and created_by = auth.uid()   -- §A23: pin the author
  );
drop policy if exists "fin_open_batch - update" on fin_opening_batches;
create policy "fin_open_batch - update" on fin_opening_batches
  for update using (company_id = auth_company_id() and fin_can_configure() and status = 'draft')
           with check (company_id = auth_company_id() and fin_can_configure());
drop policy if exists "fin_open_batch - delete" on fin_opening_batches;
create policy "fin_open_batch - delete" on fin_opening_batches
  for delete using (company_id = auth_company_id() and fin_can_configure() and status = 'draft');

drop policy if exists "fin_open_lines - select" on fin_opening_lines;
create policy "fin_open_lines - select" on fin_opening_lines
  for select using (company_id = auth_company_id() and fin_can_view());
-- Lines are writable ONLY while the batch is a draft. Once posted, the batch is the source record of a
-- posted entry — editing it would make the staging table disagree with the ledger it produced, and the
-- staging table is what a future auditor will read to understand where the opening position came from.
drop policy if exists "fin_open_lines - write" on fin_opening_lines;
create policy "fin_open_lines - write" on fin_opening_lines
  for all using (
    company_id = auth_company_id() and fin_can_configure()
    and exists (select 1 from fin_opening_batches b where b.id = batch_id and b.status = 'draft')
  ) with check (
    company_id = auth_company_id() and fin_can_configure()
    and exists (select 1 from fin_opening_batches b where b.id = batch_id and b.status = 'draft')
  );

-- §A23: freeze the author and the tenant. Without this, a controller could re-point a batch at another
-- company or rewrite who imported it.
create or replace function fin_opening_batch_freeze() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.company_id := old.company_id;
  new.created_by := old.created_by;
  return new;
end $$;
drop trigger if exists fin_opening_batch_freeze_trg on fin_opening_batches;
create trigger fin_opening_batch_freeze_trg before update on fin_opening_batches
  for each row execute function fin_opening_batch_freeze();

drop trigger if exists fin_audit_trg on fin_opening_batches;
create trigger fin_audit_trg after insert or update or delete on fin_opening_batches
  for each row execute function fin_audit();
