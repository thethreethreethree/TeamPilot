-- 0139 — Financial System, Phase-2D: Purchase Orders (pre-bill commitments; no GL impact)
--
-- A PO is a commitment to buy — it does NOT post to the ledger (no accounting entry until it
-- becomes a bill). Converting a PO creates a DRAFT bill (which then follows the normal
-- approve→GL→pay flow). Clean, decision-independent: no accounting nuance to guess.
--
-- Idempotent (A12). Draft-lock RLS applied up front (the AP-audit lesson). Audit-tracked.

create table if not exists fin_purchase_orders (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  vendor_id     uuid not null references fin_vendors(id) on delete restrict,
  po_number     text not null,
  order_date    date not null,
  expected_date date,
  status        text not null default 'draft' check (status in ('draft','approved','converted','cancelled')),
  memo          text,
  converted_bill_id uuid references fin_bills(id) on delete set null,
  created_by    uuid references auth.users(id) on delete set null,
  approved_by   uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint fin_po_number_uq unique (company_id, vendor_id, po_number)
);
create index if not exists fin_po_company_status_idx on fin_purchase_orders (company_id, status);

create table if not exists fin_po_lines (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  po_id       uuid not null references fin_purchase_orders(id) on delete cascade,
  line_no     int not null,
  account_id  uuid not null references fin_accounts(id) on delete restrict,  -- expense/asset when billed
  description text,
  amount      numeric(19,4) not null check (amount >= 0),
  tax_amount  numeric(19,4) not null default 0 check (tax_amount >= 0)
);
create index if not exists fin_po_lines_po_idx on fin_po_lines (po_id);

-- Approve a PO (commit it). Enter-level creates drafts; approve marks it committed. No GL impact.
create or replace function fin_approve_po(p_po_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_company uuid; v_status text; v_creator uuid;
begin
  if not fin_can_approve() then raise exception 'Not authorized to approve purchase orders'; end if;
  select company_id, status, created_by into v_company, v_status, v_creator from fin_purchase_orders where id = p_po_id;
  if v_company is null or v_company <> auth_company_id() then raise exception 'PO not found in your company'; end if;
  if v_status <> 'draft' then raise exception 'Only a draft PO can be approved (current: %)', v_status; end if;
  if v_creator = auth.uid() then raise exception 'Segregation of duties: you cannot approve a PO you created'; end if;
  update fin_purchase_orders set status = 'approved', approved_by = auth.uid() where id = p_po_id;
end $$;

-- Convert an (approved or draft) PO into a DRAFT bill, copying its lines. The bill then follows the
-- normal approve→GL→pay flow. Marks the PO converted + links the bill.
create or replace function fin_convert_po_to_bill(p_po_id uuid, p_bill_number text, p_bill_date date)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_company uuid; v_status text; v_vendor uuid; v_bill uuid;
begin
  if not fin_can_enter() then raise exception 'Not authorized to convert purchase orders'; end if;
  select company_id, status, vendor_id into v_company, v_status, v_vendor from fin_purchase_orders where id = p_po_id;
  if v_company is null or v_company <> auth_company_id() then raise exception 'PO not found in your company'; end if;
  if v_status = 'converted' then raise exception 'This PO was already converted to a bill'; end if;
  if v_status = 'cancelled' then raise exception 'A cancelled PO cannot be converted'; end if;

  insert into fin_bills (company_id, vendor_id, bill_number, bill_date, status, memo, created_by)
    values (v_company, v_vendor, p_bill_number, p_bill_date, 'draft',
            'From PO ' || (select po_number from fin_purchase_orders where id = p_po_id), auth.uid())
    returning id into v_bill;
  insert into fin_bill_lines (company_id, bill_id, line_no, account_id, description, amount, tax_amount)
    select v_company, v_bill, line_no, account_id, description, amount, tax_amount
    from fin_po_lines where po_id = p_po_id order by line_no;

  update fin_purchase_orders set status = 'converted', converted_bill_id = v_bill where id = p_po_id;
  return v_bill;   -- a DRAFT bill — approve it via the normal AP flow
end $$;

-- ── RLS (draft-lock from the start) ──
alter table fin_purchase_orders enable row level security;
alter table fin_po_lines        enable row level security;

drop policy if exists "fin_po - select" on fin_purchase_orders;
create policy "fin_po - select" on fin_purchase_orders for select using (company_id = auth_company_id() and fin_can_view());
drop policy if exists "fin_po - insert" on fin_purchase_orders;
create policy "fin_po - insert" on fin_purchase_orders for insert with check (company_id = auth_company_id() and fin_can_enter() and status = 'draft');
drop policy if exists "fin_po - update draft" on fin_purchase_orders;
create policy "fin_po - update draft" on fin_purchase_orders for update using (company_id = auth_company_id() and fin_can_enter() and status = 'draft') with check (company_id = auth_company_id() and fin_can_enter() and status in ('draft','cancelled'));
drop policy if exists "fin_po - delete draft" on fin_purchase_orders;
create policy "fin_po - delete draft" on fin_purchase_orders for delete using (company_id = auth_company_id() and fin_can_enter() and status = 'draft');

drop policy if exists "fin_po_lines - select" on fin_po_lines;
create policy "fin_po_lines - select" on fin_po_lines for select using (company_id = auth_company_id() and fin_can_view());
drop policy if exists "fin_po_lines - write draft" on fin_po_lines;
create policy "fin_po_lines - write draft" on fin_po_lines for all
  using (company_id = auth_company_id() and fin_can_enter() and exists (select 1 from fin_purchase_orders o where o.id = po_id and o.status = 'draft'))
  with check (company_id = auth_company_id() and fin_can_enter() and exists (select 1 from fin_purchase_orders o where o.id = po_id and o.status = 'draft'));

drop trigger if exists fin_audit_trg on fin_purchase_orders;
create trigger fin_audit_trg after insert or update or delete on fin_purchase_orders for each row execute function fin_audit();
drop trigger if exists fin_audit_trg on fin_po_lines;
create trigger fin_audit_trg after insert or update or delete on fin_po_lines for each row execute function fin_audit();
