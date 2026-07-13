-- 0160 — PHASE 2 (remainder): CORPORATE CARD TRANSACTION RECONCILIATION.
--
-- Spec: FinancialSystem.md §4 Phase 2 — "Corporate card transaction reconciliation".
--
-- §A28 — THE PRECEDENT DECIDES THE SHAPE, so this is an alignment to build, not a design to invent.
-- 0145 already built bank reconciliation: import statement lines → dedupe on external_id → auto-match on
-- (±3 days, equal amount, single candidate) → manual match / ignore for the rest. A corporate-card
-- statement is the SAME problem against a different source. Inventing a second reconciliation idiom here
-- would be the §A13 failure (authoring the space twice, then letting the two drift). So the tables, the
-- statuses, the dedupe key and the match discipline all mirror 0145 deliberately.
--
-- WHAT IS DIFFERENT, AND WHY
-- A bank line reconciles to a POSTED JOURNAL ENTRY (the money already left the ledger's cash account).
-- A card line reconciles to an EXPENSE ITEM (the employee's claim for the spend). That is the real
-- accounting difference between the two surfaces:
--   • bank:  "did this ledger entry actually clear the bank?"
--   • card:  "is this card charge backed by a claimed, approved expense — or is it unsubstantiated?"
-- The unmatched card line is therefore the interesting artefact: it is spend on the company's card that
-- NOBODY HAS CLAIMED. That is the control this feature exists to give you, and it is why the worklist
-- below surfaces unmatched charges rather than hiding them.
--
-- MONEY: numeric(19,4), comparisons in SQL — never float (§3).
-- CONCURRENCY: fin_match_card_txn locks the card line before checking its status, so two clerks cannot
-- both match the same charge (the row-lock class swept in 0127/0132/0152/0153, §A26).
-- Idempotent (§A12). RLS company-pinned + capability-gated + created_by pinned/frozen (§A23).
--
-- NOT VERIFIED against a live database (no DB access). BUILT, not TESTED.

-- ─── The cards themselves ─────────────────────────────────────────────
create table if not exists fin_corporate_cards (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade,
  holder_id    uuid references auth.users(id) on delete set null,   -- who carries it (may be a shared card)
  label        text not null,                                        -- "Ops Amex", "Marketing Visa"
  last4        text check (last4 is null or last4 ~ '^[0-9]{4}$'),
  provider     text,
  currency     char(3) not null default 'EUR',
  is_active    boolean not null default true,
  created_by   uuid not null default auth.uid() references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint fin_corp_card_label_uq unique (company_id, label)
);
create index if not exists fin_corp_card_company_idx
  on fin_corporate_cards (company_id, is_active);

-- ─── Imported card statement lines (mirrors fin_bank_transactions) ────
create table if not exists fin_card_transactions (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade,
  card_id      uuid not null references fin_corporate_cards(id) on delete cascade,
  txn_date     date not null,
  amount       numeric(19,4) not null,          -- signed: a charge is positive, a refund negative
  merchant     text,
  description  text,
  external_id  text,                             -- provider's line id → dedupe key, exactly as 0145
  status       text not null default 'unmatched'
                 check (status in ('unmatched','matched','ignored')),
  created_by   uuid not null default auth.uid() references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  -- Same dedupe contract as the bank import: re-importing the same statement must not double-count.
  constraint fin_card_txn_dedupe unique (card_id, external_id)
);
create index if not exists fin_card_txn_status_idx
  on fin_card_transactions (card_id, status, txn_date);

-- ─── Matches: one card line ↔ one expense item (mirrors fin_reconciliation_matches) ──
create table if not exists fin_card_matches (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies(id) on delete cascade,
  card_transaction_id uuid not null references fin_card_transactions(id) on delete cascade,
  expense_item_id     uuid not null references fin_expense_items(id) on delete restrict,
  matched_by          uuid not null default auth.uid() references auth.users(id) on delete set null,
  matched_at          timestamptz not null default now(),
  -- One match per card line: a single charge cannot be substantiated by two different claims.
  constraint fin_card_match_txn_uq unique (card_transaction_id),
  -- …and one claim cannot substantiate two charges (that would be a duplicate reimbursement).
  constraint fin_card_match_item_uq unique (expense_item_id)
);
create index if not exists fin_card_match_item_idx
  on fin_card_matches (expense_item_id);

-- ─── Auto-match: same rule as the bank (±3 days, equal amount, single candidate) ──
-- Deliberately conservative. If two expense items could explain one charge, we do NOT guess — the line
-- stays unmatched for a human. A wrong auto-match is worse than no match: it marks a real charge as
-- substantiated by the wrong claim, and the unsubstantiated-spend control silently fails (§A25: a false
-- MATCH is strictly worse than a miss).
create or replace function fin_auto_match_card(p_card_id uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare v_company uuid; v_txn record; v_item uuid; v_n int := 0; v_cnt int;
begin
  if not fin_can_enter() then raise exception 'Not authorized to reconcile card transactions'; end if;
  select company_id into v_company from fin_corporate_cards where id = p_card_id;
  if v_company is null or v_company <> auth_company_id() then
    raise exception 'Card not found in your company';
  end if;

  for v_txn in
    select * from fin_card_transactions
     where card_id = p_card_id and status = 'unmatched'
  loop
    -- candidates: an unmatched expense item, same company, same absolute amount, within ±3 days
    select count(*), min(ei.id) into v_cnt, v_item
      from fin_expense_items ei
      join fin_expense_reports er on er.id = ei.report_id
     where er.company_id = v_company
       and abs(ei.amount + ei.tax_amount - abs(v_txn.amount)) < 0.005      -- equal to the cent
       and ei.expense_date between v_txn.txn_date - 3 and v_txn.txn_date + 3
       and not exists (select 1 from fin_card_matches m where m.expense_item_id = ei.id);

    if v_cnt = 1 then
      insert into fin_card_matches (company_id, card_transaction_id, expense_item_id, matched_by)
        values (v_company, v_txn.id, v_item, auth.uid());
      update fin_card_transactions set status = 'matched' where id = v_txn.id;
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $$;

-- ─── Manual match / ignore ────────────────────────────────────────────
create or replace function fin_match_card_txn(p_txn_id uuid, p_expense_item_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_company uuid; v_status text; v_item_company uuid;
begin
  if not fin_can_enter() then raise exception 'Not authorized to reconcile card transactions'; end if;
  -- lock the line first: two clerks must not both match the same charge (§A26 row-lock class)
  select company_id, status into v_company, v_status
    from fin_card_transactions where id = p_txn_id for update;
  if v_company is null or v_company <> auth_company_id() then
    raise exception 'Card transaction not found in your company';
  end if;
  if v_status <> 'unmatched' then
    raise exception 'Only an unmatched card transaction can be matched (current: %)', v_status;
  end if;

  select er.company_id into v_item_company
    from fin_expense_items ei join fin_expense_reports er on er.id = ei.report_id
   where ei.id = p_expense_item_id;
  if v_item_company is null or v_item_company <> v_company then
    raise exception 'Expense item not found in your company';
  end if;

  insert into fin_card_matches (company_id, card_transaction_id, expense_item_id, matched_by)
    values (v_company, p_txn_id, p_expense_item_id, auth.uid());
  update fin_card_transactions set status = 'matched' where id = p_txn_id;
end $$;

create or replace function fin_ignore_card_txn(p_txn_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_company uuid; v_status text;
begin
  if not fin_can_enter() then raise exception 'Not authorized to reconcile card transactions'; end if;
  select company_id, status into v_company, v_status
    from fin_card_transactions where id = p_txn_id for update;
  if v_company is null or v_company <> auth_company_id() then
    raise exception 'Card transaction not found in your company';
  end if;
  if v_status <> 'unmatched' then
    raise exception 'Only an unmatched card transaction can be ignored (current: %)', v_status;
  end if;
  update fin_card_transactions set status = 'ignored' where id = p_txn_id;
end $$;

-- ─── The control this feature exists for: unsubstantiated card spend ──
create or replace view fin_card_positions as
select
  c.id as card_id, c.company_id, c.label, c.last4, c.provider, c.currency, c.is_active,
  c.holder_id,
  (select count(*) from fin_card_transactions t
    where t.card_id = c.id and t.status = 'unmatched')                     as unmatched_count,
  (select coalesce(sum(t.amount), 0) from fin_card_transactions t
    where t.card_id = c.id and t.status = 'unmatched')                     as unmatched_total,
  (select coalesce(sum(t.amount), 0) from fin_card_transactions t
    where t.card_id = c.id)                                                as imported_total
from fin_corporate_cards c;

-- ─── RLS (the 0145 finance idiom) ─────────────────────────────────────
alter table fin_corporate_cards   enable row level security;
alter table fin_card_transactions enable row level security;
alter table fin_card_matches      enable row level security;

drop policy if exists "fin_corp_card - select" on fin_corporate_cards;
create policy "fin_corp_card - select" on fin_corporate_cards
  for select using (company_id = auth_company_id() and fin_can_view());
drop policy if exists "fin_corp_card - insert" on fin_corporate_cards;
create policy "fin_corp_card - insert" on fin_corporate_cards
  for insert with check (company_id = auth_company_id() and fin_can_configure() and created_by = auth.uid());
drop policy if exists "fin_corp_card - update" on fin_corporate_cards;
create policy "fin_corp_card - update" on fin_corporate_cards
  for update using (company_id = auth_company_id() and fin_can_configure())
  with check (company_id = auth_company_id() and fin_can_configure());
drop policy if exists "fin_corp_card - delete" on fin_corporate_cards;
create policy "fin_corp_card - delete" on fin_corporate_cards
  for delete using (company_id = auth_company_id() and fin_can_configure());

drop policy if exists "fin_card_txn - select" on fin_card_transactions;
create policy "fin_card_txn - select" on fin_card_transactions
  for select using (company_id = auth_company_id() and fin_can_view());
drop policy if exists "fin_card_txn - insert" on fin_card_transactions;
create policy "fin_card_txn - insert" on fin_card_transactions
  for insert with check (company_id = auth_company_id() and fin_can_enter() and created_by = auth.uid());
drop policy if exists "fin_card_txn - update" on fin_card_transactions;
create policy "fin_card_txn - update" on fin_card_transactions
  for update using (company_id = auth_company_id() and fin_can_enter())
  with check (company_id = auth_company_id() and fin_can_enter());
drop policy if exists "fin_card_txn - delete" on fin_card_transactions;
create policy "fin_card_txn - delete" on fin_card_transactions
  for delete using (company_id = auth_company_id() and fin_can_configure());

drop policy if exists "fin_card_match - select" on fin_card_matches;
create policy "fin_card_match - select" on fin_card_matches
  for select using (company_id = auth_company_id() and fin_can_view());
drop policy if exists "fin_card_match - delete" on fin_card_matches;
create policy "fin_card_match - delete" on fin_card_matches
  for delete using (company_id = auth_company_id() and fin_can_enter());

drop trigger if exists fin_freeze_creator on fin_corporate_cards;
create trigger fin_freeze_creator before update on fin_corporate_cards
  for each row execute function fin_freeze_created_by();
drop trigger if exists fin_freeze_creator on fin_card_transactions;
create trigger fin_freeze_creator before update on fin_card_transactions
  for each row execute function fin_freeze_created_by();

drop trigger if exists fin_audit_trg on fin_corporate_cards;
create trigger fin_audit_trg after insert or update or delete on fin_corporate_cards
  for each row execute function fin_audit();
drop trigger if exists fin_audit_trg on fin_card_transactions;
create trigger fin_audit_trg after insert or update or delete on fin_card_transactions
  for each row execute function fin_audit();
