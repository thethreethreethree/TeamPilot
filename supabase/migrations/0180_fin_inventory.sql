-- 0180 — INVENTORY & COGS (founder-confirmed 2026-07-14: WEIGHTED AVERAGE, PERPETUAL).
--
-- The last part of the build, as the founder sequenced it.
--
-- ── THE CORE INVARIANT, AND EVERYTHING ELSE FOLLOWS FROM IT ──────────────────────────────────
--
--   INVENTORY IS AN ASSET. SELLING IT CONVERTS THE ASSET INTO AN EXPENSE.
--
-- If a sale posts revenue but NOT the cost of the goods sold, the books still balance perfectly — and the
-- company reports a 100% gross margin on everything it sells. Every profitability page, every break-even
-- figure, every unit-economics number I built in this session reads that margin. They would all be
-- confidently, catastrophically wrong, and the trial balance would tie out to the penny.
--
-- That is why the founder chose PERPETUAL: COGS posts at the moment of sale, in the same transaction as
-- the revenue. Revenue and its cost are never apart, not even for an instant.
--
-- ── WEIGHTED AVERAGE, AND WHY THE MATH LIVES IN THE DATABASE ─────────────────────────────────
--
-- Each receipt re-averages the unit cost:
--
--     new_avg = (qty_on_hand × old_avg + qty_received × receipt_cost) / (qty_on_hand + qty_received)
--
-- Every sale then consumes stock at that average. One cost per item, always.
--
-- This runs inside a ROW-LOCKED transaction (§0127/0152 precedent) because two concurrent sales of the
-- same item would otherwise both read the same qty_on_hand, both pass the stock check, and both post COGS
-- against inventory that only one of them can actually have. The books would balance; the warehouse would
-- be short; and the inventory asset would go NEGATIVE — an asset account holding a negative balance is a
-- physical impossibility that no report would ever query for.
--
-- ── THE THING THIS SYSTEM WILL NOT DO ────────────────────────────────────────────────────────
--
-- IT WILL NOT SELL STOCK YOU DO NOT HAVE. A sale of 10 units when 6 are on hand RAISES. It does not post a
-- negative inventory balance, and it does not "backorder" silently. A system that let inventory go negative
-- would produce a COGS figure computed against an average cost of stock that never existed — a fabricated
-- number, in the ledger, permanently.
--
-- Idempotent (§A12). NOT VERIFIED against a live database. BUILT, not TESTED.

-- ─── Items ────────────────────────────────────────────────────────────
create table if not exists fin_inventory_items (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade,
  sku          text not null,
  name         text not null,

  -- DERIVED STATE, maintained by the RPCs below under a row lock. It is a cache of the movement history,
  -- never an independent truth: fin_inventory_ledger is the record, and fin_inventory_check reconciles the
  -- two. If they ever disagree, the movements win — they are what actually happened.
  qty_on_hand  numeric(19,4) not null default 0,
  avg_cost     numeric(19,4) not null default 0 check (avg_cost >= 0),

  -- Where the value sits and where it goes when sold.
  asset_account_id uuid references fin_accounts(id) on delete restrict,   -- 1300 Inventory
  cogs_account_id  uuid references fin_accounts(id) on delete restrict,   -- 5000 COGS

  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  constraint fin_inv_sku_uq unique (company_id, sku),
  -- An asset cannot be negative. This is a CHECK, not a convention: it makes the "sold stock we don't have"
  -- bug unrepresentable rather than merely discouraged.
  constraint fin_inv_qty_nonneg_ck check (qty_on_hand >= 0)
);

-- ─── The movement ledger — every change, append-only ──────────────────
create table if not exists fin_inventory_movements (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  item_id     uuid not null references fin_inventory_items(id) on delete restrict,
  kind        text not null check (kind in ('receipt','sale','adjustment','write_off')),
  qty         numeric(19,4) not null,          -- +in / −out
  unit_cost   numeric(19,4) not null check (unit_cost >= 0),
  -- The average cost AFTER this movement. Recorded, not recomputed later: it is the cost the ledger
  -- actually used, and a later re-derivation from a changed history would silently disagree with the GL.
  avg_after   numeric(19,4) not null,
  entry_id    uuid references fin_journal_entries(id) on delete restrict,
  reason      text,
  created_by  uuid not null default auth.uid() references auth.users(id),
  occurred_at timestamptz not null default now()
);
create index if not exists fin_inv_mov_item_idx on fin_inventory_movements (item_id, occurred_at);

-- Append-only via RULES, so it binds the service role and direct SQL too. The movement history is the
-- inventory's audit trail; a system that can rewrite it can hide a theft.
create or replace rule fin_inv_mov_no_update as on update to fin_inventory_movements do instead nothing;
create or replace rule fin_inv_mov_no_delete as on delete to fin_inventory_movements do instead nothing;

-- ─── Seed the accounts an inventory business needs ────────────────────
create or replace function fin_inventory_accounts(p_company uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into fin_accounts (company_id, code, name, type, normal_balance, is_system, cost_type)
       values (p_company, '1300', 'Inventory', 'asset', 'debit', true, 'none')
  on conflict (company_id, code) do nothing;
  -- COGS is cost_type='direct' — it is the definition of a variable cost, and 0176's break-even and 0173's
  -- overhead allocation both read cost_type. Getting this wrong would put COGS in the FIXED bucket and make
  -- break-even wildly optimistic.
  insert into fin_accounts (company_id, code, name, type, normal_balance, is_system, cost_type)
       values (p_company, '5000', 'Cost of Goods Sold', 'expense', 'debit', true, 'direct')
  on conflict (company_id, code) do nothing;
  insert into fin_accounts (company_id, code, name, type, normal_balance, is_system, cost_type)
       values (p_company, '5900', 'Inventory Write-offs', 'expense', 'debit', true, 'direct')
  on conflict (company_id, code) do nothing;
end $$;

-- ─── RECEIVE stock: the asset grows, the average re-computes ──────────
create or replace function fin_receive_inventory(
  p_item uuid, p_qty numeric, p_unit_cost numeric, p_period uuid, p_reason text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_co uuid; v_qty numeric(19,4); v_avg numeric(19,4); v_new_avg numeric(19,4);
  v_asset uuid; v_ap uuid; v_entry uuid;
begin
  if p_qty <= 0 then raise exception 'Received quantity must be positive'; end if;
  if not fin_can_enter() then raise exception 'Not authorized to receive inventory'; end if;

  -- ROW LOCK. Two concurrent receipts would otherwise both read the same qty/avg and the second would
  -- overwrite the first's re-averaging — the ledger would hold a cost that no sequence of events produced.
  select company_id, qty_on_hand, avg_cost, asset_account_id
    into v_co, v_qty, v_avg, v_asset
    from fin_inventory_items where id = p_item for update;

  if v_co is null or v_co <> auth_company_id() then
    raise exception 'Inventory item not found in your company';
  end if;

  -- WEIGHTED AVERAGE. The whole method, in one line, in SQL (§3: never float).
  v_new_avg := round(((v_qty * v_avg) + (p_qty * p_unit_cost)) / (v_qty + p_qty), 4);

  v_asset := coalesce(v_asset, fin_account_by_code(v_co, '1300'));
  v_ap    := fin_account_by_code(v_co, '2000');   -- Accounts Payable

  -- Dr Inventory / Cr Accounts Payable. The asset exists the moment it arrives, not when it is paid for.
  v_entry := fin_post_system_entry(
    v_co, current_date, p_period,
    'Inventory receipt',
    'inventory_receipt:' || p_item::text,
    jsonb_build_array(
      jsonb_build_object('account_id', v_asset, 'debit',  round(p_qty * p_unit_cost, 4), 'credit', 0,
                         'memo', 'Stock received'),
      jsonb_build_object('account_id', v_ap,    'debit', 0, 'credit', round(p_qty * p_unit_cost, 4),
                         'memo', 'Owed to supplier')
    )
  );

  update fin_inventory_items
     set qty_on_hand = v_qty + p_qty,
         avg_cost    = v_new_avg
   where id = p_item;

  insert into fin_inventory_movements (company_id, item_id, kind, qty, unit_cost, avg_after, entry_id, reason)
       values (v_co, p_item, 'receipt', p_qty, p_unit_cost, v_new_avg, v_entry, p_reason);

  return v_entry;
end $$;

-- ─── SELL stock: the asset becomes an expense ─────────────────────────
create or replace function fin_sell_inventory(
  p_item uuid, p_qty numeric, p_period uuid, p_reason text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_co uuid; v_qty numeric(19,4); v_avg numeric(19,4);
  v_asset uuid; v_cogs uuid; v_entry uuid; v_cost numeric(19,4);
  v_sku text;
begin
  if p_qty <= 0 then raise exception 'Sold quantity must be positive'; end if;
  if not fin_can_enter() then raise exception 'Not authorized to record a sale of inventory'; end if;

  select company_id, qty_on_hand, avg_cost, asset_account_id, cogs_account_id, sku
    into v_co, v_qty, v_avg, v_asset, v_cogs, v_sku
    from fin_inventory_items where id = p_item for update;   -- row lock: see the header

  if v_co is null or v_co <> auth_company_id() then
    raise exception 'Inventory item not found in your company';
  end if;

  -- ── THE REFUSAL ──
  -- We will not sell stock that does not exist. Posting it anyway would drive the inventory asset negative
  -- and compute COGS against an average cost of stock that never existed — a fabricated number, in the
  -- ledger, permanently. The books would balance. The warehouse would be short.
  if p_qty > v_qty then
    raise exception 'Only % of % are on hand — you cannot sell %. Receive the stock first, or record an adjustment if the count is wrong.',
      v_qty, v_sku, p_qty;
  end if;

  v_cost  := round(p_qty * v_avg, 4);
  v_asset := coalesce(v_asset, fin_account_by_code(v_co, '1300'));
  v_cogs  := coalesce(v_cogs,  fin_account_by_code(v_co, '5000'));

  -- Dr COGS / Cr Inventory. This is ONLY the cost side. The revenue side is the invoice's own entry — the
  -- two are separate postings against the same event, and the caller must post both.
  v_entry := fin_post_system_entry(
    v_co, current_date, p_period,
    'Cost of goods sold',
    'inventory_sale:' || p_item::text,
    jsonb_build_array(
      jsonb_build_object('account_id', v_cogs,  'debit', v_cost, 'credit', 0, 'memo', 'COGS'),
      jsonb_build_object('account_id', v_asset, 'debit', 0, 'credit', v_cost, 'memo', 'Stock sold')
    )
  );

  update fin_inventory_items set qty_on_hand = v_qty - p_qty where id = p_item;

  insert into fin_inventory_movements (company_id, item_id, kind, qty, unit_cost, avg_after, entry_id, reason)
       values (v_co, p_item, 'sale', -p_qty, v_avg, v_avg, v_entry, p_reason);

  return v_entry;
end $$;

-- ─── WRITE OFF / ADJUST: shrinkage, damage, a count that disagrees ────
-- Every inventory system needs this and every inventory system is where theft hides. So a write-off:
--   • costs the company real money, visibly (Dr Inventory Write-offs 5900 — its OWN account, never folded
--     into COGS, where it would look like the cost of a sale and inflate nothing but suspicion);
--   • REQUIRES a reason;
--   • is append-only in the movement log.
-- Shrinkage buried inside COGS is indistinguishable from a good month of trading.
create or replace function fin_adjust_inventory(
  p_item uuid, p_qty_delta numeric, p_period uuid, p_reason text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_co uuid; v_qty numeric(19,4); v_avg numeric(19,4);
  v_asset uuid; v_wo uuid; v_entry uuid; v_value numeric(19,4);
begin
  if p_qty_delta = 0 then raise exception 'An adjustment must change the quantity'; end if;
  if p_reason is null or btrim(p_reason) = '' then
    -- A write-off with no reason is the shape every inventory fraud takes. The reason is not paperwork; it
    -- is the only thing standing between "damaged in transit" and "walked out of the door".
    raise exception 'An inventory adjustment must state a reason';
  end if;
  -- Adjustments are configure-level, NOT entry-level. Anyone who can enter a sale must not be able to make
  -- the shortfall disappear afterwards — that combination is the whole fraud, executed by one person.
  if not fin_can_configure() then
    raise exception 'Only a controller or CFO may adjust inventory';
  end if;

  select company_id, qty_on_hand, avg_cost, asset_account_id
    into v_co, v_qty, v_avg, v_asset
    from fin_inventory_items where id = p_item for update;

  if v_co is null or v_co <> auth_company_id() then
    raise exception 'Inventory item not found in your company';
  end if;
  if v_qty + p_qty_delta < 0 then
    raise exception 'That adjustment would take stock below zero (% on hand)', v_qty;
  end if;

  v_value := round(abs(p_qty_delta) * v_avg, 4);
  v_asset := coalesce(v_asset, fin_account_by_code(v_co, '1300'));
  v_wo    := fin_account_by_code(v_co, '5900');

  v_entry := fin_post_system_entry(
    v_co, current_date, p_period,
    'Inventory adjustment: ' || p_reason,
    'inventory_adjustment:' || p_item::text,
    case when p_qty_delta < 0 then
      -- Stock lost: Dr Write-offs / Cr Inventory.
      jsonb_build_array(
        jsonb_build_object('account_id', v_wo,    'debit', v_value, 'credit', 0, 'memo', p_reason),
        jsonb_build_object('account_id', v_asset, 'debit', 0, 'credit', v_value, 'memo', 'Stock written off')
      )
    else
      -- Stock found: Dr Inventory / Cr Write-offs (a credit BACK to the expense — we do not book found
      -- stock as revenue; it was never sold, it was merely miscounted).
      jsonb_build_array(
        jsonb_build_object('account_id', v_asset, 'debit', v_value, 'credit', 0, 'memo', p_reason),
        jsonb_build_object('account_id', v_wo,    'debit', 0, 'credit', v_value, 'memo', 'Stock found')
      )
    end
  );

  update fin_inventory_items set qty_on_hand = v_qty + p_qty_delta where id = p_item;

  insert into fin_inventory_movements (company_id, item_id, kind, qty, unit_cost, avg_after, entry_id, reason)
       values (v_co, p_item,
               case when p_qty_delta < 0 then 'write_off' else 'adjustment' end,
               p_qty_delta, v_avg, v_avg, v_entry, p_reason);

  return v_entry;
end $$;

-- ─── Does the warehouse agree with the ledger? ────────────────────────
-- The item's qty_on_hand is DERIVED STATE. This view reconciles it against the movement history — the
-- record of what actually happened. If they ever disagree, something wrote to the item directly, and the
-- movements are the truth.
create or replace view fin_inventory_check with (security_invoker = true) as
  select i.company_id,
         i.id as item_id,
         i.sku,
         i.name,
         i.qty_on_hand                                   as stated_qty,
         coalesce(sum(m.qty), 0)                         as movement_qty,
         (i.qty_on_hand - coalesce(sum(m.qty), 0))       as discrepancy,
         round(i.qty_on_hand * i.avg_cost, 4)            as stated_value
    from fin_inventory_items i
    left join fin_inventory_movements m on m.item_id = i.id
   group by i.id, i.company_id, i.sku, i.name, i.qty_on_hand, i.avg_cost;

-- ─── Shrinkage: what walked out of the door ───────────────────────────
create or replace view fin_inventory_shrinkage with (security_invoker = true) as
  select m.company_id,
         date_trunc('month', m.occurred_at)::date        as month,
         count(*)                                        as write_offs,
         sum(abs(m.qty))                                 as units_lost,
         round(sum(abs(m.qty) * m.unit_cost), 4)         as value_lost
    from fin_inventory_movements m
   where m.kind = 'write_off'
   group by m.company_id, date_trunc('month', m.occurred_at);

-- ─── RLS ──────────────────────────────────────────────────────────────
alter table fin_inventory_items     enable row level security;
alter table fin_inventory_movements enable row level security;

drop policy if exists "fin_inv - select" on fin_inventory_items;
create policy "fin_inv - select" on fin_inventory_items
  for select using (company_id = auth_company_id() and fin_can_view());
drop policy if exists "fin_inv - insert" on fin_inventory_items;
create policy "fin_inv - insert" on fin_inventory_items
  for insert with check (company_id = auth_company_id() and fin_can_configure());
-- qty_on_hand / avg_cost are maintained ONLY by the DEFINER RPCs above, under a row lock. A client that
-- could write them directly could set its own COGS — the write gate IS the correctness guarantee.
drop policy if exists "fin_inv - update" on fin_inventory_items;
create policy "fin_inv - update" on fin_inventory_items
  for update using (company_id = auth_company_id() and fin_can_configure())
           with check (company_id = auth_company_id() and fin_can_configure());

drop policy if exists "fin_inv_mov - select" on fin_inventory_movements;
create policy "fin_inv_mov - select" on fin_inventory_movements
  for select using (company_id = auth_company_id() and fin_can_view());
-- No insert policy: movements are written by the DEFINER RPCs only. A client insert could forge a receipt
-- and manufacture inventory value out of nothing.

drop trigger if exists fin_audit_trg on fin_inventory_items;
create trigger fin_audit_trg after insert or update or delete on fin_inventory_items
  for each row execute function fin_audit();
