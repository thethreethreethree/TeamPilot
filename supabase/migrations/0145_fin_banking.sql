-- 0145 — Financial System, PHASE 3: Banking & Reconciliation (founder-confirmed 2026-07-13).
--
-- Decisions: (1) CSV statement import first (Plaid is a later drop-in via the same
-- fin_bank_transactions shape, source='plaid'); (2) ONE GL cash account per bank account
-- (bank_account.gl_account_id → its own cash COA account, clean per-account reconciliation);
-- (3) auto-match tolerance ±3 days on the date (amounts must equal).
--
-- The GL stays the source of truth. Bank data is a SEPARATE feed matched to posted GL cash lines;
-- reconciliation proves "the ledger agrees with the bank". Bank balances never override the GL —
-- discrepancies are surfaced (unmatched worklist), not silently absorbed.
--
-- Security lessons from this session applied: created_by/imported author pinned (RLS + default) AND
-- frozen on UPDATE (0142 fin_freeze_created_by); capability-gated; company_id in every with-check;
-- append-only matches. Idempotent.

-- ── A real bank / card account. Each maps to ONE cash GL account (decision 2). ──
create table if not exists fin_bank_accounts (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  name          text not null,
  institution   text,
  mask          text,                          -- last-4 or similar, display only
  currency      char(3),
  gl_account_id uuid not null references fin_accounts(id) on delete restrict,
  is_active     boolean not null default true,
  created_by    uuid default auth.uid() references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint fin_bank_accounts_name_uq unique (company_id, name)
);
create index if not exists fin_bank_accounts_company_idx on fin_bank_accounts (company_id, is_active);

-- ── Imported bank lines. amount is SIGNED: + deposit (money in), − withdrawal (money out). ──
create table if not exists fin_bank_transactions (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  bank_account_id uuid not null references fin_bank_accounts(id) on delete cascade,
  txn_date        date not null,
  amount          numeric(19,4) not null,
  description     text,
  external_id     text,                        -- dedupe key from the source (CSV ref / Plaid id)
  status          text not null default 'unmatched' check (status in ('unmatched','matched','ignored')),
  source          text not null default 'csv' check (source in ('csv','plaid')),
  imported_at     timestamptz not null default now(),
  created_by      uuid default auth.uid() references auth.users(id) on delete set null,
  -- dedupe: the same external_id can't be imported twice for a bank account (nulls are allowed to
  -- repeat, so a source without stable ids still imports — at the cost of dedupe for that source).
  constraint fin_bank_txn_dedupe unique (bank_account_id, external_id)
);
create index if not exists fin_bank_txn_account_status_idx on fin_bank_transactions (bank_account_id, status);

-- ── Reconciliation link: a bank transaction ↔ the GL entry that represents it. Append-only. ──
create table if not exists fin_reconciliation_matches (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies(id) on delete cascade,
  bank_transaction_id uuid not null references fin_bank_transactions(id) on delete cascade,
  entry_id            uuid not null references fin_journal_entries(id) on delete restrict,
  matched_by          uuid default auth.uid() references auth.users(id) on delete set null,
  matched_at          timestamptz not null default now(),
  constraint fin_recon_txn_uq unique (bank_transaction_id)   -- one match per bank line
);
create index if not exists fin_recon_entry_idx on fin_reconciliation_matches (entry_id);

-- ── Auto-match: for each unmatched bank line, find the single posted GL cash line (on this bank's
--    gl_account) with an equal amount and a date within ±3 days that is not already matched. Exactly
--    one candidate → match; 0 or >1 → leave for the manual worklist. Returns the count matched. ──
create or replace function fin_auto_match_bank(p_bank_account_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_company uuid; v_gl uuid; v_txn record; v_entry uuid; v_n int; v_matched int := 0;
begin
  if not fin_can_enter() then raise exception 'Not authorized to reconcile'; end if;
  select company_id, gl_account_id into v_company, v_gl from fin_bank_accounts where id = p_bank_account_id;
  if v_company is null or v_company <> auth_company_id() then raise exception 'Bank account not found in your company'; end if;

  for v_txn in
    select * from fin_bank_transactions where bank_account_id = p_bank_account_id and status = 'unmatched'
  loop
    -- Candidate posted entries whose cash line on this GL account matches the signed amount + date.
    with cand as (
      select e.id
      from fin_journal_lines l
      join fin_journal_entries e on e.id = l.entry_id
      where l.account_id = v_gl and e.status = 'posted'
        and e.entry_date between v_txn.txn_date - 3 and v_txn.txn_date + 3
        and ((v_txn.amount > 0 and l.base_debit = v_txn.amount)
          or (v_txn.amount < 0 and l.base_credit = -v_txn.amount))
        and not exists (select 1 from fin_reconciliation_matches m where m.entry_id = e.id)
      group by e.id
    )
    select count(*), min(id) into v_n, v_entry from cand;
    if v_n = 1 then
      insert into fin_reconciliation_matches (company_id, bank_transaction_id, entry_id)
        values (v_company, v_txn.id, v_entry)
        on conflict (bank_transaction_id) do nothing;
      update fin_bank_transactions set status = 'matched' where id = v_txn.id;
      v_matched := v_matched + 1;
    end if;
  end loop;
  return v_matched;
end $$;

-- ── Manual match: link one bank line to one posted entry (the worklist "match" action). ──
create or replace function fin_match_bank_txn(p_txn_id uuid, p_entry_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_company uuid; v_ecompany uuid; v_status text;
begin
  if not fin_can_enter() then raise exception 'Not authorized to reconcile'; end if;
  select company_id, status into v_company, v_status from fin_bank_transactions where id = p_txn_id;
  if v_company is null or v_company <> auth_company_id() then raise exception 'Bank transaction not found in your company'; end if;
  if v_status = 'matched' then raise exception 'That bank line is already matched'; end if;
  select company_id into v_ecompany from fin_journal_entries where id = p_entry_id and status = 'posted';
  if v_ecompany is null or v_ecompany <> auth_company_id() then raise exception 'Entry not found (or not posted) in your company'; end if;
  insert into fin_reconciliation_matches (company_id, bank_transaction_id, entry_id)
    values (v_company, p_txn_id, p_entry_id);
  update fin_bank_transactions set status = 'matched' where id = p_txn_id;
end $$;

-- ── Cash position per bank account: the linked GL cash-account balance + unmatched count. ──
create or replace view fin_bank_positions with (security_invoker = true) as
select
  ba.id, ba.company_id, ba.name, ba.institution, ba.mask, ba.currency, ba.is_active, ba.gl_account_id,
  (select coalesce(sum(l.base_debit - l.base_credit), 0)
     from fin_journal_lines l join fin_journal_entries e on e.id = l.entry_id
     where l.account_id = ba.gl_account_id and e.status = 'posted') as gl_balance,
  (select count(*) from fin_bank_transactions t where t.bank_account_id = ba.id and t.status = 'unmatched') as unmatched_count
from fin_bank_accounts ba;

-- ── RLS ──
alter table fin_bank_accounts        enable row level security;
alter table fin_bank_transactions    enable row level security;
alter table fin_reconciliation_matches enable row level security;

-- Bank accounts: setup = configure-level; everyone with view can see them.
drop policy if exists "fin_bank_accounts - select" on fin_bank_accounts;
create policy "fin_bank_accounts - select" on fin_bank_accounts
  for select using (company_id = auth_company_id() and fin_can_view());
drop policy if exists "fin_bank_accounts - write" on fin_bank_accounts;
create policy "fin_bank_accounts - write" on fin_bank_accounts
  for all using (company_id = auth_company_id() and fin_can_configure())
  with check (company_id = auth_company_id() and fin_can_configure() and created_by = auth.uid());

-- Bank transactions: import/manage = enter-level; author pinned.
drop policy if exists "fin_bank_txn - select" on fin_bank_transactions;
create policy "fin_bank_txn - select" on fin_bank_transactions
  for select using (company_id = auth_company_id() and fin_can_view());
drop policy if exists "fin_bank_txn - insert" on fin_bank_transactions;
create policy "fin_bank_txn - insert" on fin_bank_transactions
  for insert with check (company_id = auth_company_id() and fin_can_enter() and created_by = auth.uid());
drop policy if exists "fin_bank_txn - update" on fin_bank_transactions;
create policy "fin_bank_txn - update" on fin_bank_transactions
  for update using (company_id = auth_company_id() and fin_can_enter())
  with check (company_id = auth_company_id() and fin_can_enter());
-- (status flips to matched happen via the DEFINER match fns, which bypass RLS; the update policy
--  covers the manual "ignore" action from the client.)

-- Matches: written only by the DEFINER reconcile functions; members may read. Append-only (no update/delete policy).
drop policy if exists "fin_recon - select" on fin_reconciliation_matches;
create policy "fin_recon - select" on fin_reconciliation_matches
  for select using (company_id = auth_company_id() and fin_can_view());

-- created_by / author freeze (0142 lesson) + audit.
drop trigger if exists fin_freeze_creator on fin_bank_accounts;
create trigger fin_freeze_creator before update on fin_bank_accounts
  for each row execute function fin_freeze_created_by();
drop trigger if exists fin_freeze_creator on fin_bank_transactions;
create trigger fin_freeze_creator before update on fin_bank_transactions
  for each row execute function fin_freeze_created_by();

drop trigger if exists fin_audit_trg on fin_bank_accounts;
create trigger fin_audit_trg after insert or update or delete on fin_bank_accounts for each row execute function fin_audit();
drop trigger if exists fin_audit_trg on fin_bank_transactions;
create trigger fin_audit_trg after insert or update or delete on fin_bank_transactions for each row execute function fin_audit();
drop trigger if exists fin_audit_trg on fin_reconciliation_matches;
create trigger fin_audit_trg after insert or update or delete on fin_reconciliation_matches for each row execute function fin_audit();
