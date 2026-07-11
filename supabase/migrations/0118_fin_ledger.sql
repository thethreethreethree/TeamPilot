-- 0118 — Financial System, Increment 3: the double-entry ledger (THE CRUX)
--
-- Built to the confirmed model. This is where "the ledger always balances" becomes real, enforced
-- at the DATABASE level (not app trust). Delivers:
--   • fin_journal_entries (header) + fin_journal_lines (debits/credits)
--   • server-computed base amounts (client cannot lie about converted values)
--   • line CHECKs: debit XOR credit (T-10)
--   • fin_post_entry() RPC: the ONLY sanctioned path to 'posted' — checks approver role, SoD
--     (approved_by <> created_by, T-15), open period (T-19), >=2 lines (T-9), balance (T-8),
--     assigns a gap-free per-company entry_no, atomically
--   • a DEFERRABLE constraint trigger re-asserting balance at COMMIT for any posted entry (T-8
--     backstop — even a direct write cannot leave a posted entry unbalanced)
--   • immutability: posted entries/lines cannot change (T-14); nothing in a closed/locked period
--     can change (T-18); direct client INSERT of a 'posted' entry is blocked (must use the RPC)
--   • fin_reverse_entry() RPC: correction via a new swapped-line entry (T-17), original untouched
--   • completes the 0116 fin_accounts delete guard now that lines exist (no delete of a used acct)
--
-- Idempotent (A12). Acceptance: docs/financial-system/tests/0118_ledger.test.sql.
-- Money is numeric(19,4); ALL money math is here in SQL, never JS (decision #3).

-- ── Per-company gap-free entry numbering (decision #5: per-company sequential) ──
create table if not exists fin_entry_counters (
  company_id    uuid primary key references companies(id) on delete cascade,
  next_entry_no bigint not null default 1
);

-- ── Journal entry header ──
create table if not exists fin_journal_entries (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  entry_no    bigint,                       -- assigned at post time; null while draft
  entry_date  date not null,
  period_id   uuid not null references fin_periods(id) on delete restrict,
  description text not null,
  reference   text,
  status      text not null default 'draft' check (status in ('draft','pending_approval','posted','void')),
  source      text not null default 'manual',
  reversal_of uuid references fin_journal_entries(id) on delete restrict,
  created_by  uuid not null default auth.uid() references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  posted_at   timestamptz,
  created_at  timestamptz not null default now(),
  constraint fin_entries_company_no_uq unique (company_id, entry_no)
);
create index if not exists fin_entries_company_status_idx on fin_journal_entries (company_id, status);
create index if not exists fin_entries_period_idx on fin_journal_entries (period_id);

-- ── Journal lines (the debits & credits) ──
create table if not exists fin_journal_lines (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,  -- denormalized for RLS
  entry_id    uuid not null references fin_journal_entries(id) on delete cascade,
  line_no     int not null,
  account_id  uuid not null references fin_accounts(id) on delete restrict,
  debit       numeric(19,4) not null default 0,
  credit      numeric(19,4) not null default 0,
  currency    char(3),                       -- defaulted to company base by trigger if null
  fx_rate     numeric(19,8) not null default 1,
  base_debit  numeric(19,4) not null default 0,   -- server-computed (trigger), never client-trusted
  base_credit numeric(19,4) not null default 0,   -- server-computed
  memo        text,
  cost_center_id uuid,                        -- reserved for Phase 4
  -- T-10: a line is a debit XOR a credit — never both, never neither; never negative.
  constraint fin_lines_nonneg_ck check (debit >= 0 and credit >= 0),
  constraint fin_lines_debit_xor_credit_ck check ((debit > 0) <> (credit > 0))
);
create index if not exists fin_lines_entry_idx on fin_journal_lines (entry_id);
create index if not exists fin_lines_account_idx on fin_journal_lines (account_id);

-- ── Server-compute base amounts (client cannot set converted values) ──
-- currency defaults to the company base; base_* = round(face × fx_rate, 4). Increment 4 adds the
-- exchange-rate LOOKUP; for now fx_rate is whatever was supplied (default 1), so a single-currency
-- entry has base = face. Making base_* trigger-computed closes the "client lies about base" hole.
create or replace function fin_lines_compute_base()
returns trigger language plpgsql
security definer set search_path = public as $$
declare v_base char(3);
begin
  if NEW.currency is null then
    select base_currency into v_base from fin_settings where company_id = NEW.company_id;
    NEW.currency := coalesce(v_base, 'USD');
  end if;
  NEW.base_debit  := round(NEW.debit  * NEW.fx_rate, 4);
  NEW.base_credit := round(NEW.credit * NEW.fx_rate, 4);
  return NEW;
end $$;

drop trigger if exists fin_lines_compute_base_trg on fin_journal_lines;
create trigger fin_lines_compute_base_trg
  before insert or update on fin_journal_lines
  for each row execute function fin_lines_compute_base();

-- ── Immutability: posted entries + closed/locked periods ──
create or replace function fin_entries_immutable()
returns trigger language plpgsql
security definer set search_path = public as $$
declare v_pstatus text; v_check_period uuid;
begin
  -- posted entries are terminal: no update/delete (correct via a reversing entry instead).
  if (TG_OP = 'UPDATE' or TG_OP = 'DELETE') and OLD.status = 'posted' then
    raise exception 'fin: a posted entry is immutable — reverse it, do not edit it';
  end if;
  -- closed/locked period: nothing (insert/update/delete) may touch it.
  v_check_period := coalesce(NEW.period_id, OLD.period_id);
  select status into v_pstatus from fin_periods where id = v_check_period;
  if v_pstatus in ('closed','locked') then
    raise exception 'fin: period is % — post corrections into an open period', v_pstatus;
  end if;
  return coalesce(NEW, OLD);
end $$;

drop trigger if exists fin_entries_immutable_trg on fin_journal_entries;
create trigger fin_entries_immutable_trg
  before insert or update or delete on fin_journal_entries
  for each row execute function fin_entries_immutable();

create or replace function fin_lines_immutable()
returns trigger language plpgsql
security definer set search_path = public as $$
declare v_estatus text; v_period uuid; v_pstatus text;
begin
  select status, period_id into v_estatus, v_period
    from fin_journal_entries where id = coalesce(NEW.entry_id, OLD.entry_id);
  if v_estatus = 'posted' then
    raise exception 'fin: lines of a posted entry are immutable';
  end if;
  select status into v_pstatus from fin_periods where id = v_period;
  if v_pstatus in ('closed','locked') then
    raise exception 'fin: period is % — cannot modify its lines', v_pstatus;
  end if;
  return coalesce(NEW, OLD);
end $$;

drop trigger if exists fin_lines_immutable_trg on fin_journal_lines;
create trigger fin_lines_immutable_trg
  before insert or update or delete on fin_journal_lines
  for each row execute function fin_lines_immutable();

-- ── T-8 backstop: DEFERRED balance assertion at COMMIT (the real DB-level guarantee) ──
-- Shared assertion: a POSTED entry must have >= 2 lines and balance in base currency.
create or replace function fin_assert_entry_balanced(p_entry uuid)
returns void language plpgsql
security definer set search_path = public as $$
declare v_status text; v_d numeric(19,4); v_c numeric(19,4); v_n int;
begin
  select status into v_status from fin_journal_entries where id = p_entry;
  if v_status is distinct from 'posted' then return; end if;  -- only posted must balance
  select coalesce(sum(base_debit),0), coalesce(sum(base_credit),0), count(*)
    into v_d, v_c, v_n from fin_journal_lines where entry_id = p_entry;
  if v_n < 2 then raise exception 'fin: posted entry % has < 2 lines', p_entry; end if;
  if v_d <> v_c then raise exception 'fin: posted entry % is UNBALANCED (debit % <> credit %)', p_entry, v_d, v_c; end if;
end $$;

-- Fired at COMMIT (deferred) from BOTH sides, so multi-line inserts may be temporarily unbalanced
-- mid-transaction but MUST balance by commit — no matter HOW an entry reaches 'posted':
--   • the ENTRY trigger catches the post transition itself (an entry UPDATE to status='posted'),
--     the primary case the RPC drives AND any direct/service-role status flip;
--   • the LINES trigger catches any line change on an already-posted entry.
create or replace function fin_assert_balanced_from_lines()
returns trigger language plpgsql security definer set search_path = public as $$
begin perform fin_assert_entry_balanced(coalesce(NEW.entry_id, OLD.entry_id)); return null; end $$;

create or replace function fin_assert_balanced_from_entry()
returns trigger language plpgsql security definer set search_path = public as $$
begin perform fin_assert_entry_balanced(NEW.id); return null; end $$;

drop trigger if exists fin_assert_balanced_trg on fin_journal_lines;
create constraint trigger fin_assert_balanced_trg
  after insert or update or delete on fin_journal_lines
  deferrable initially deferred
  for each row execute function fin_assert_balanced_from_lines();

drop trigger if exists fin_assert_balanced_entry_trg on fin_journal_entries;
create constraint trigger fin_assert_balanced_entry_trg
  after insert or update on fin_journal_entries
  deferrable initially deferred
  for each row execute function fin_assert_balanced_from_entry();

-- ── fin_post_entry: the ONLY sanctioned path to 'posted' ──
create or replace function fin_post_entry(p_entry_id uuid)
returns bigint language plpgsql
security definer set search_path = public as $$
declare
  v_company uuid; v_status text; v_created_by uuid; v_period uuid; v_pstatus text;
  v_d numeric(19,4); v_c numeric(19,4); v_n int; v_no bigint;
begin
  if not fin_can_approve() then
    raise exception 'Not authorized to post entries (need approver/controller/cfo)';
  end if;
  select company_id, status, created_by, period_id
    into v_company, v_status, v_created_by, v_period
    from fin_journal_entries where id = p_entry_id;
  if v_company is null or v_company <> auth_company_id() then
    raise exception 'Entry not found in your company';
  end if;
  if v_status not in ('draft','pending_approval') then
    raise exception 'Only a draft/pending entry can be posted (current: %)', v_status;
  end if;
  -- T-15 segregation of duties: the approver cannot be the creator.
  if v_created_by = auth.uid() then
    raise exception 'Segregation of duties: you cannot approve/post an entry you created';
  end if;
  -- T-19: period must be open.
  select status into v_pstatus from fin_periods where id = v_period;
  if v_pstatus is distinct from 'open' then
    raise exception 'Cannot post into a % period', coalesce(v_pstatus,'missing');
  end if;
  -- T-9 + T-8: >= 2 lines and balanced (in base currency).
  select coalesce(sum(base_debit),0), coalesce(sum(base_credit),0), count(*)
    into v_d, v_c, v_n from fin_journal_lines where entry_id = p_entry_id;
  if v_n < 2 then raise exception 'An entry needs at least 2 lines'; end if;
  if v_d <> v_c then raise exception 'Entry does not balance (debit % <> credit %)', v_d, v_c; end if;
  -- Gap-free per-company number (row-locked counter).
  insert into fin_entry_counters (company_id, next_entry_no) values (v_company, 1)
    on conflict (company_id) do nothing;
  update fin_entry_counters set next_entry_no = next_entry_no + 1
    where company_id = v_company returning next_entry_no - 1 into v_no;
  update fin_journal_entries
    set status = 'posted', approved_by = auth.uid(), posted_at = now(), entry_no = v_no
    where id = p_entry_id;
  return v_no;
end $$;

-- ── fin_reverse_entry: correction via a new swapped-line entry (T-17) ──
-- Creates the reversal as a DRAFT (swapped debit<->credit) linked via reversal_of. It is posted
-- through the NORMAL fin_post_entry path — which means a DIFFERENT approver must post it (SoD
-- holds: the person creating a reversal cannot also approve it). The original entry is untouched.
create or replace function fin_reverse_entry(p_entry_id uuid, p_period_id uuid, p_entry_date date)
returns uuid language plpgsql
security definer set search_path = public as $$
declare v_company uuid; v_new uuid; v_estatus text;
begin
  if not fin_can_enter() then
    raise exception 'Not authorized to create a reversal';
  end if;
  select company_id, status into v_company, v_estatus from fin_journal_entries where id = p_entry_id;
  if v_company is null or v_company <> auth_company_id() then
    raise exception 'Entry not found in your company';
  end if;
  if v_estatus <> 'posted' then
    raise exception 'Only a posted entry can be reversed (current: %)', v_estatus;
  end if;
  insert into fin_journal_entries (company_id, entry_date, period_id, description, source, reversal_of, created_by, status)
    values (v_company, p_entry_date, p_period_id,
            'Reversal of entry ' || p_entry_id::text, 'system', p_entry_id, auth.uid(), 'draft')
    returning id into v_new;
  -- swap debit<->credit on every line. Preserve the ORIGINAL fx_rate so the reversal EXACTLY
  -- negates the original in base currency — reversing a foreign-currency entry at a later date's
  -- rate would otherwise not balance and could not post. The trust flag tells the base-computation
  -- trigger (0119) to use the provided rate for THIS system operation instead of re-looking-it-up.
  perform set_config('fin.trust_provided_rate', '1', true);
  insert into fin_journal_lines (company_id, entry_id, line_no, account_id, debit, credit, currency, fx_rate, memo)
    select v_company, v_new, line_no, account_id, credit, debit, currency, fx_rate, 'Reversal'
    from fin_journal_lines where entry_id = p_entry_id;
  perform set_config('fin.trust_provided_rate', '', true);
  return v_new;  -- a DRAFT — post via fin_post_entry (a DIFFERENT approver; SoD preserved)
end $$;

-- ── Complete the 0116 fin_accounts delete guard now that lines exist ──
create or replace function fin_accounts_protect_delete()
returns trigger language plpgsql
security definer set search_path = public as $$
begin
  if OLD.is_system then
    raise exception 'fin_accounts: system account % cannot be deleted', OLD.code;
  end if;
  if exists (select 1 from fin_journal_lines where account_id = OLD.id) then
    raise exception 'fin_accounts: account % has journal lines — deactivate it, do not delete', OLD.code;
  end if;
  return OLD;
end $$;

-- ── RLS ──
alter table fin_journal_entries enable row level security;
alter table fin_journal_lines   enable row level security;
alter table fin_entry_counters  enable row level security;

-- Entries: view with finance access; CREATE/EDIT drafts requires enter-capability. A client may
-- only insert a draft/pending entry (WITH CHECK status <> 'posted') — 'posted' is reachable ONLY
-- through fin_post_entry (SECURITY DEFINER), so no one can PostgREST-insert a fake posted entry.
drop policy if exists "fin_entries - select" on fin_journal_entries;
create policy "fin_entries - select" on fin_journal_entries
  for select using (company_id = auth_company_id() and fin_can_view());
drop policy if exists "fin_entries - insert" on fin_journal_entries;
create policy "fin_entries - insert" on fin_journal_entries
  for insert with check (
    company_id = auth_company_id() and fin_can_enter()
    and status in ('draft','pending_approval') and created_by = auth.uid()
  );
drop policy if exists "fin_entries - update" on fin_journal_entries;
create policy "fin_entries - update" on fin_journal_entries
  for update using (company_id = auth_company_id() and fin_can_enter())
  with check (company_id = auth_company_id() and fin_can_enter() and status in ('draft','pending_approval'));
drop policy if exists "fin_entries - delete" on fin_journal_entries;
create policy "fin_entries - delete" on fin_journal_entries
  for delete using (company_id = auth_company_id() and fin_can_enter());

-- Lines: same enter-capability; the immutability trigger blocks posted/closed regardless.
drop policy if exists "fin_lines - select" on fin_journal_lines;
create policy "fin_lines - select" on fin_journal_lines
  for select using (company_id = auth_company_id() and fin_can_view());
drop policy if exists "fin_lines - write" on fin_journal_lines;
create policy "fin_lines - write" on fin_journal_lines
  for all using (company_id = auth_company_id() and fin_can_enter())
  with check (company_id = auth_company_id() and fin_can_enter());

-- Counters: never client-writable (only the SECURITY DEFINER post path touches them). Readable
-- for finance viewers. No insert/update/delete policy → default-deny for end users.
drop policy if exists "fin_counters - select" on fin_entry_counters;
create policy "fin_counters - select" on fin_entry_counters
  for select using (company_id = auth_company_id() and fin_can_view());
