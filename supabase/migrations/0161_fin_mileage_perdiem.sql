-- 0161 — PHASE 2 (remainder): MILEAGE / PER-DIEM HANDLING.
--
-- Spec: FinancialSystem.md §4 Phase 2 — "Mileage / per-diem handling".
--
-- THE POINT OF THIS FEATURE
-- A receipt expense states its own amount ("this dinner cost 42.30"). A mileage or per-diem expense does
-- NOT: the employee states a QUANTITY (180 km, 3 days) and the COMPANY's rate decides the money. So the
-- amount must be DERIVED, not submitted. If the client sends the amount, an employee can claim 180 km at
-- whatever rate they like, and the "policy" is decoration.
--
-- Hence the central rule here (§3 "every derived figure must be traceable"; §A23 "never trust a
-- client-supplied value the authorization/valuation model reads as ground truth"):
--
--     amount = round(rate * quantity, 4)   COMPUTED BY A DATABASE TRIGGER, in numeric — never float,
--     never client-supplied. The rate is resolved from the company's effective-dated rate table as of
--     the EXPENSE DATE, not as of today.
--
-- WHY EFFECTIVE-DATED RATES (and not a single mutable "current rate" column)
-- A rate change must not silently rewrite history. If the mileage rate rises in March, a January claim
-- must still value at January's rate — otherwise re-computing an old report would change a number that
-- was already approved and posted to the ledger (§3: closed periods immutable; records append-only).
-- So rates are rows with effective_from, and resolution picks the latest rate <= the expense date.
--
-- A per-diem is the same shape with a different unit (days, optionally per jurisdiction).
--
-- Idempotent (§A12). RLS company-pinned + capability-gated (§A23): rates are CONFIGURE-level (an
-- employee must not be able to set the rate their own claim is valued at — that is the same
-- self-raisable-ceiling class as 0157's approval_limit).
--
-- NOT VERIFIED against a live database (no DB access). BUILT, not TESTED.

-- ─── Effective-dated rate tables ──────────────────────────────────────
create table if not exists fin_mileage_rates (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references companies(id) on delete cascade,
  effective_from date not null,
  rate_per_unit  numeric(19,4) not null check (rate_per_unit >= 0),
  unit           text not null default 'km' check (unit in ('km','mi')),
  currency       char(3) not null default 'EUR',
  note           text,
  created_by     uuid not null default auth.uid() references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  constraint fin_mileage_rate_uq unique (company_id, effective_from, unit)
);
create index if not exists fin_mileage_rate_idx
  on fin_mileage_rates (company_id, unit, effective_from desc);

create table if not exists fin_per_diem_rates (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references companies(id) on delete cascade,
  effective_from date not null,
  jurisdiction   text not null default 'default',   -- 'default', 'DE', 'US-CA', …
  daily_rate     numeric(19,4) not null check (daily_rate >= 0),
  currency       char(3) not null default 'EUR',
  note           text,
  created_by     uuid not null default auth.uid() references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  constraint fin_per_diem_rate_uq unique (company_id, effective_from, jurisdiction)
);
create index if not exists fin_per_diem_rate_idx
  on fin_per_diem_rates (company_id, jurisdiction, effective_from desc);

-- ─── Expense items gain a KIND and a QUANTITY ─────────────────────────
alter table fin_expense_items add column if not exists kind text;
alter table fin_expense_items add column if not exists quantity numeric(19,4);
alter table fin_expense_items add column if not exists jurisdiction text;

-- Backfill legacy rows before constraining: everything that exists today is a receipt claim.
update fin_expense_items set kind = 'receipt' where kind is null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fin_expense_items_kind_ck') then
    alter table fin_expense_items
      add constraint fin_expense_items_kind_ck
      check (kind in ('receipt','mileage','per_diem'));
  end if;
  -- A derived claim MUST carry a positive quantity; a receipt claim must not carry one.
  if not exists (select 1 from pg_constraint where conname = 'fin_expense_items_qty_ck') then
    alter table fin_expense_items
      add constraint fin_expense_items_qty_ck
      check (
        (kind = 'receipt'  and quantity is null)
        or (kind in ('mileage','per_diem') and quantity is not null and quantity > 0)
      );
  end if;
end $$;

alter table fin_expense_items alter column kind set default 'receipt';
alter table fin_expense_items alter column kind set not null;

-- ─── Rate resolution: as of the EXPENSE DATE, never "today" ───────────
create or replace function fin_mileage_rate_for(p_company uuid, p_date date, p_unit text default 'km')
returns numeric(19,4)
language sql stable security definer set search_path = public as $$
  select rate_per_unit from fin_mileage_rates
   where company_id = p_company and unit = coalesce(p_unit,'km')
     and effective_from <= coalesce(p_date, current_date)
   order by effective_from desc
   limit 1;
$$;

create or replace function fin_per_diem_rate_for(p_company uuid, p_date date, p_jurisdiction text default 'default')
returns numeric(19,4)
language sql stable security definer set search_path = public as $$
  select daily_rate from fin_per_diem_rates
   where company_id = p_company
     and jurisdiction = coalesce(p_jurisdiction,'default')
     and effective_from <= coalesce(p_date, current_date)
   order by effective_from desc
   limit 1;
$$;

-- ─── The amount is DERIVED, server-side, and cannot be client-supplied ─
create or replace function fin_compute_expense_item_amount()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_rate numeric(19,4);
begin
  if NEW.kind = 'receipt' then
    return NEW;                       -- a receipt states its own amount; nothing to derive
  end if;

  -- The item's company comes from its parent report (fin_expense_items carries company_id too, but the
  -- report is the authority on whose claim this is).
  if NEW.kind = 'mileage' then
    v_rate := fin_mileage_rate_for(NEW.company_id, NEW.expense_date, 'km');
    if v_rate is null then
      raise exception 'No mileage rate is configured for % — a controller must set one before mileage can be claimed', coalesce(NEW.expense_date::text, 'that date');
    end if;
  else
    v_rate := fin_per_diem_rate_for(NEW.company_id, NEW.expense_date, NEW.jurisdiction);
    if v_rate is null then
      raise exception 'No per-diem rate is configured for jurisdiction % — a controller must set one first', coalesce(NEW.jurisdiction,'default');
    end if;
  end if;

  -- §3: money math in SQL, exact decimal. The submitted amount is IGNORED and overwritten — the claim
  -- states the quantity, the company states the rate, the database states the money.
  NEW.amount := round(v_rate * NEW.quantity, 4);
  return NEW;
end $$;

drop trigger if exists fin_expense_item_amount_trg on fin_expense_items;
create trigger fin_expense_item_amount_trg
  before insert or update on fin_expense_items
  for each row execute function fin_compute_expense_item_amount();

-- ─── RLS: rates are CONFIGURE-level (an employee cannot set the rate their own claim is valued at) ──
alter table fin_mileage_rates  enable row level security;
alter table fin_per_diem_rates enable row level security;

drop policy if exists "fin_mileage_rates - select" on fin_mileage_rates;
create policy "fin_mileage_rates - select" on fin_mileage_rates
  for select using (company_id = auth_company_id() and fin_can_view());
drop policy if exists "fin_mileage_rates - insert" on fin_mileage_rates;
create policy "fin_mileage_rates - insert" on fin_mileage_rates
  for insert with check (company_id = auth_company_id() and fin_can_configure() and created_by = auth.uid());
drop policy if exists "fin_mileage_rates - update" on fin_mileage_rates;
create policy "fin_mileage_rates - update" on fin_mileage_rates
  for update using (company_id = auth_company_id() and fin_can_configure())
  with check (company_id = auth_company_id() and fin_can_configure());
drop policy if exists "fin_mileage_rates - delete" on fin_mileage_rates;
create policy "fin_mileage_rates - delete" on fin_mileage_rates
  for delete using (company_id = auth_company_id() and fin_can_configure());

drop policy if exists "fin_per_diem_rates - select" on fin_per_diem_rates;
create policy "fin_per_diem_rates - select" on fin_per_diem_rates
  for select using (company_id = auth_company_id() and fin_can_view());
drop policy if exists "fin_per_diem_rates - insert" on fin_per_diem_rates;
create policy "fin_per_diem_rates - insert" on fin_per_diem_rates
  for insert with check (company_id = auth_company_id() and fin_can_configure() and created_by = auth.uid());
drop policy if exists "fin_per_diem_rates - update" on fin_per_diem_rates;
create policy "fin_per_diem_rates - update" on fin_per_diem_rates
  for update using (company_id = auth_company_id() and fin_can_configure())
  with check (company_id = auth_company_id() and fin_can_configure());
drop policy if exists "fin_per_diem_rates - delete" on fin_per_diem_rates;
create policy "fin_per_diem_rates - delete" on fin_per_diem_rates
  for delete using (company_id = auth_company_id() and fin_can_configure());

drop trigger if exists fin_freeze_creator on fin_mileage_rates;
create trigger fin_freeze_creator before update on fin_mileage_rates
  for each row execute function fin_freeze_created_by();
drop trigger if exists fin_freeze_creator on fin_per_diem_rates;
create trigger fin_freeze_creator before update on fin_per_diem_rates
  for each row execute function fin_freeze_created_by();

drop trigger if exists fin_audit_trg on fin_mileage_rates;
create trigger fin_audit_trg after insert or update or delete on fin_mileage_rates
  for each row execute function fin_audit();
drop trigger if exists fin_audit_trg on fin_per_diem_rates;
create trigger fin_audit_trg after insert or update or delete on fin_per_diem_rates
  for each row execute function fin_audit();
