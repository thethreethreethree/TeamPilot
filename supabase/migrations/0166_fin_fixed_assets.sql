-- 0166 — PHASE 8 (Part B): FIXED ASSET REGISTER + DEPRECIATION + DISPOSAL.
--
-- Built against the CONFIRMED Phase-8 data model (docs/financial-system/PHASE-8-DATA-MODEL.md), which the
-- founder confirmed. Payroll is deliberately NOT built here — per the founder's decision, payroll is
-- INTEGRATED (we post what a provider computes) rather than rebuilt. This migration is Part B only.
--
-- This also fills a hole I flagged when building the Cash Flow Statement (0164): its INVESTING section is
-- empty because no account carries subtype='fixed'. Once assets exist and are posted against, those
-- movements start appearing in Investing automatically — no change to 0164.
--
-- ── THE TWO PLACES DEPRECIATION GOES WRONG ────────────────────────────────────────────────────
--
-- 1. THE SALVAGE FLOOR. Straight-line depreciation is (cost − salvage) / useful_life_months per month.
--    Run it one month too long and net book value drops BELOW salvage — the books then claim the asset is
--    worth less than the amount you could scrap it for, which is not a rounding error but a false asset
--    valuation on the balance sheet. So the final period is CLAMPED to the remaining depreciable base, not
--    given a full monthly slice. This is asserted in the acceptance SQL, because it is invisible until the
--    very last month of an asset's life — by which time nobody is watching.
--
-- 2. DOUBLE-POSTING. Depreciation is run monthly, often by a scheduled job, often re-run after a failure.
--    If a re-run posts a second slice for the same (asset, period), the expense doubles and accumulated
--    depreciation runs ahead of reality — silently, because both entries balance perfectly. So
--    (asset_id, period_id) is UNIQUE, and the run function skips what already exists rather than raising.
--    Idempotent by construction (§A12's discipline applied to a posting function rather than a migration).
--
-- Both failures balance. Neither is caught by the ledger's balance assertion. That is the recurring shape
-- of every real defect in this system.
--
-- ── ACCOUNTS ──────────────────────────────────────────────────────────────────────────────────
-- Three accounts are required. They are seeded here (idempotently) rather than assumed to exist:
--   1900 Accumulated Depreciation  — CONTRA-ASSET. Credit-normal despite being an asset-type account, so
--                                    it is typed 'liability' would be WRONG; it is an asset with a credit
--                                    balance. Postgres' type↔normal_balance CHECK (0116) forbids
--                                    asset+credit, so it is modelled as a liability-typed contra account —
--                                    the standard workaround when the schema enforces the pairing. It nets
--                                    against fixed assets on the balance sheet.
--   6500 Depreciation Expense      — expense, debit-normal.
--   7100 Gain/Loss on Disposal     — revenue-typed (credit-normal); a LOSS posts as a debit to it, which
--                                    is a negative revenue. Standard and traceable.
--
-- Idempotent (§A12). NOT VERIFIED against a live database. BUILT, not TESTED.

-- ─── Seed the required system accounts (idempotent; no-op if already present) ──
insert into fin_accounts (company_id, code, name, type, subtype, normal_balance, is_system)
select c.id, v.code, v.name, v.type, v.subtype, v.nb, true
from companies c
cross join (values
  ('1900','Accumulated Depreciation','liability','contra_asset','credit'),
  ('6500','Depreciation Expense','expense','operating','debit'),
  ('7100','Gain/Loss on Disposal','revenue','other','credit')
) as v(code,name,type,subtype,nb)
where exists (select 1 from fin_accounts a where a.company_id = c.id)   -- only companies with a COA
on conflict (company_id, code) do nothing;

-- ─── The register ─────────────────────────────────────────────────────────────
create table if not exists fin_fixed_assets (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references companies(id) on delete cascade,
  name               text not null,
  asset_account_id   uuid not null references fin_accounts(id) on delete restrict,  -- where the cost sits
  acquired_date      date not null,
  cost               numeric(19,4) not null check (cost > 0),
  salvage_value      numeric(19,4) not null default 0 check (salvage_value >= 0),
  useful_life_months int  not null check (useful_life_months > 0),
  method             text not null default 'straight_line' check (method in ('straight_line')),
  status             text not null default 'active' check (status in ('active','disposed')),
  disposed_date      date,
  cost_center_id     uuid references fin_cost_centers(id) on delete set null,
  project_id         uuid references fin_projects(id) on delete set null,
  created_by         uuid not null default auth.uid() references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  -- You cannot depreciate below what the thing is worth as scrap.
  constraint fin_asset_salvage_lt_cost_ck check (salvage_value < cost)
);
create index if not exists fin_fixed_assets_company_idx
  on fin_fixed_assets (company_id, status, acquired_date);

-- ─── Posted depreciation, one row per (asset, period) — APPEND-ONLY ───────────
create table if not exists fin_depreciation_entries (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  asset_id    uuid not null references fin_fixed_assets(id) on delete restrict,
  period_id   uuid not null references fin_periods(id) on delete restrict,
  amount      numeric(19,4) not null check (amount > 0),
  entry_id    uuid not null references fin_journal_entries(id) on delete restrict,
  posted_by   uuid default auth.uid() references auth.users(id) on delete set null,
  posted_at   timestamptz not null default now(),
  -- THE GUARD AGAINST DOUBLE-POSTING. A monthly job that re-runs after a failure must not post a second
  -- slice: the expense would double and accumulated depreciation would outrun reality — silently, since
  -- both entries balance perfectly.
  constraint fin_depr_asset_period_uq unique (asset_id, period_id)
);
create index if not exists fin_depr_asset_idx on fin_depreciation_entries (asset_id, posted_at);

-- Append-only: a posted depreciation slice is history. Correct it with a reversal, never an edit.
create or replace rule fin_depr_no_update as on update to fin_depreciation_entries do instead nothing;
create or replace rule fin_depr_no_delete as on delete to fin_depreciation_entries do instead nothing;

-- ─── Net book value (derived, never stored) ───────────────────────────────────
create or replace view fin_asset_register with (security_invoker = true) as
select
  a.id, a.company_id, a.name, a.acquired_date, a.cost, a.salvage_value,
  a.useful_life_months, a.method, a.status, a.disposed_date,
  a.cost_center_id, a.project_id,
  coalesce((select sum(d.amount) from fin_depreciation_entries d where d.asset_id = a.id), 0)
    as accumulated_depreciation,
  a.cost - coalesce((select sum(d.amount) from fin_depreciation_entries d where d.asset_id = a.id), 0)
    as net_book_value,
  -- How much depreciable base is left. The run function clamps to this, which is what keeps NBV >= salvage.
  greatest(
    (a.cost - a.salvage_value)
      - coalesce((select sum(d.amount) from fin_depreciation_entries d where d.asset_id = a.id), 0),
    0
  ) as remaining_depreciable
from fin_fixed_assets a;

-- ─── Run depreciation for one asset into one period ───────────────────────────
create or replace function fin_run_depreciation(p_asset_id uuid, p_period_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_company uuid; v_cost numeric(19,4); v_salv numeric(19,4); v_life int; v_status text;
  v_acquired date; v_pstatus text; v_pstart date; v_base char(3);
  v_accum numeric(19,4); v_monthly numeric(19,4); v_amount numeric(19,4);
  v_dep_acct uuid; v_accum_acct uuid; v_entry uuid; v_existing uuid;
begin
  if not fin_can_enter() then raise exception 'Not authorized to run depreciation'; end if;

  -- Lock the asset: a scheduled job and a human clicking "run" must not both post a slice.
  select company_id, cost, salvage_value, useful_life_months, status, acquired_date
    into v_company, v_cost, v_salv, v_life, v_status, v_acquired
    from fin_fixed_assets where id = p_asset_id for update;

  if v_company is null or v_company <> auth_company_id() then
    raise exception 'Asset not found in your company';
  end if;
  if v_status <> 'active' then
    raise exception 'Only an active asset depreciates (current: %)', v_status;
  end if;

  -- Idempotent: already posted for this period → return the existing entry, do NOT post again.
  select entry_id into v_existing
    from fin_depreciation_entries where asset_id = p_asset_id and period_id = p_period_id;
  if v_existing is not null then
    return v_existing;
  end if;

  select status, start_date into v_pstatus, v_pstart from fin_periods where id = p_period_id;
  if v_pstatus is distinct from 'open' then
    raise exception 'Depreciation must post into an OPEN period (period is %)', coalesce(v_pstatus,'missing');
  end if;
  if v_pstart < v_acquired then
    raise exception 'Cannot depreciate % before it was acquired (%)', p_asset_id, v_acquired;
  end if;

  select coalesce(sum(amount),0) into v_accum
    from fin_depreciation_entries where asset_id = p_asset_id;

  -- Straight line, in numeric — §3: never float.
  v_monthly := round((v_cost - v_salv) / v_life, 4);

  -- THE SALVAGE FLOOR. Clamp the final slice to what is actually left, rather than taking a full month
  -- and driving net book value below salvage — which would claim the asset is worth less than scrap.
  v_amount := least(v_monthly, (v_cost - v_salv) - v_accum);

  if v_amount <= 0 then
    raise exception 'Asset is fully depreciated (net book value has reached its salvage value)';
  end if;

  v_dep_acct   := fin_account_by_code(v_company, '6500');
  v_accum_acct := fin_account_by_code(v_company, '1900');
  if v_dep_acct is null or v_accum_acct is null then
    raise exception 'Depreciation Expense (6500) or Accumulated Depreciation (1900) account missing';
  end if;

  select base_currency into v_base from fin_settings where company_id = v_company;

  -- Dr Depreciation Expense / Cr Accumulated Depreciation. Posted through the shared subledger path, so it
  -- inherits the open-period gate, the balance assertion and gap-free numbering.
  v_entry := fin_post_system_entry(
    v_company, v_pstart, p_period_id,
    'Depreciation — ' || (select name from fin_fixed_assets where id = p_asset_id),
    'asset',
    jsonb_build_array(
      jsonb_build_object('account_id', v_dep_acct,   'debit', v_amount, 'credit', 0,
                         'currency', v_base, 'memo', 'Depreciation'),
      jsonb_build_object('account_id', v_accum_acct, 'debit', 0, 'credit', v_amount,
                         'currency', v_base, 'memo', 'Accumulated depreciation')
    )
  );

  insert into fin_depreciation_entries (company_id, asset_id, period_id, amount, entry_id, posted_by)
    values (v_company, p_asset_id, p_period_id, v_amount, v_entry, auth.uid());

  return v_entry;
end $$;

-- ─── Dispose ──────────────────────────────────────────────────────────────────
create or replace function fin_dispose_asset(
  p_asset_id uuid, p_proceeds numeric, p_period_id uuid, p_cash_code text default '1000'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_company uuid; v_cost numeric(19,4); v_status text; v_asset_acct uuid; v_accum numeric(19,4);
  v_nbv numeric(19,4); v_gain numeric(19,4); v_base char(3); v_pstatus text; v_pstart date;
  v_cash uuid; v_accum_acct uuid; v_gl_acct uuid; v_lines jsonb; v_entry uuid;
begin
  if not fin_can_approve() then raise exception 'Not authorized to dispose of assets'; end if;
  if p_proceeds is null or p_proceeds < 0 then raise exception 'Proceeds cannot be negative'; end if;

  select company_id, cost, status, asset_account_id
    into v_company, v_cost, v_status, v_asset_acct
    from fin_fixed_assets where id = p_asset_id for update;
  if v_company is null or v_company <> auth_company_id() then
    raise exception 'Asset not found in your company';
  end if;
  if v_status <> 'active' then raise exception 'Asset is already disposed'; end if;

  select status, start_date into v_pstatus, v_pstart from fin_periods where id = p_period_id;
  if v_pstatus is distinct from 'open' then
    raise exception 'Disposal must post into an OPEN period';
  end if;

  select coalesce(sum(amount),0) into v_accum
    from fin_depreciation_entries where asset_id = p_asset_id;

  v_nbv  := v_cost - v_accum;
  v_gain := p_proceeds - v_nbv;          -- positive = gain, negative = loss

  v_cash       := fin_account_by_code(v_company, coalesce(p_cash_code,'1000'));
  v_accum_acct := fin_account_by_code(v_company, '1900');
  v_gl_acct    := fin_account_by_code(v_company, '7100');
  if v_cash is null or v_accum_acct is null or v_gl_acct is null then
    raise exception 'Cash (%), Accumulated Depreciation (1900) or Gain/Loss (7100) account missing', coalesce(p_cash_code,'1000');
  end if;

  select base_currency into v_base from fin_settings where company_id = v_company;

  -- Remove the asset at COST, remove its accumulated depreciation, take the proceeds, and book the
  -- difference as gain or loss. Every one of those four is required — dropping the accumulated-depreciation
  -- reversal is the classic error, and it leaves a phantom contra-asset on the balance sheet forever.
  v_lines := '[]'::jsonb;
  if p_proceeds > 0 then
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'account_id', v_cash, 'debit', p_proceeds, 'credit', 0, 'currency', v_base, 'memo', 'Disposal proceeds'));
  end if;
  if v_accum > 0 then
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'account_id', v_accum_acct, 'debit', v_accum, 'credit', 0, 'currency', v_base, 'memo', 'Remove accumulated depreciation'));
  end if;
  v_lines := v_lines || jsonb_build_array(jsonb_build_object(
    'account_id', v_asset_acct, 'debit', 0, 'credit', v_cost, 'currency', v_base, 'memo', 'Remove asset at cost'));

  if v_gain > 0 then
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'account_id', v_gl_acct, 'debit', 0, 'credit', v_gain, 'currency', v_base, 'memo', 'Gain on disposal'));
  elsif v_gain < 0 then
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'account_id', v_gl_acct, 'debit', abs(v_gain), 'credit', 0, 'currency', v_base, 'memo', 'Loss on disposal'));
  end if;

  v_entry := fin_post_system_entry(
    v_company, v_pstart, p_period_id,
    'Disposal — ' || (select name from fin_fixed_assets where id = p_asset_id),
    'asset', v_lines
  );

  update fin_fixed_assets
     set status = 'disposed', disposed_date = v_pstart
   where id = p_asset_id;

  return v_entry;
end $$;

-- ─── RLS ──────────────────────────────────────────────────────────────────────
alter table fin_fixed_assets          enable row level security;
alter table fin_depreciation_entries  enable row level security;

drop policy if exists "fin_assets - select" on fin_fixed_assets;
create policy "fin_assets - select" on fin_fixed_assets
  for select using (company_id = auth_company_id() and fin_can_view());
drop policy if exists "fin_assets - insert" on fin_fixed_assets;
create policy "fin_assets - insert" on fin_fixed_assets
  for insert with check (company_id = auth_company_id() and fin_can_enter() and created_by = auth.uid());
drop policy if exists "fin_assets - update" on fin_fixed_assets;
create policy "fin_assets - update" on fin_fixed_assets
  for update using (company_id = auth_company_id() and fin_can_enter())
  with check (company_id = auth_company_id() and fin_can_enter());
drop policy if exists "fin_assets - delete" on fin_fixed_assets;
create policy "fin_assets - delete" on fin_fixed_assets
  for delete using (company_id = auth_company_id() and fin_can_configure());

drop policy if exists "fin_depr - select" on fin_depreciation_entries;
create policy "fin_depr - select" on fin_depreciation_entries
  for select using (company_id = auth_company_id() and fin_can_view());

drop trigger if exists fin_freeze_creator on fin_fixed_assets;
create trigger fin_freeze_creator before update on fin_fixed_assets
  for each row execute function fin_freeze_created_by();

drop trigger if exists fin_audit_trg on fin_fixed_assets;
create trigger fin_audit_trg after insert or update or delete on fin_fixed_assets
  for each row execute function fin_audit();
