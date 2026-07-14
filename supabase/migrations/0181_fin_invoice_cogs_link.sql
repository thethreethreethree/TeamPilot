-- 0181 — CLOSE THE 100%-GROSS-MARGIN GAP (founder-confirmed 2026-07-14).
--
-- ── THE GAP THIS CLOSES, WHICH I FOUND BY WRITING MY OWN BUILD REPORT ────────────────────────
--
-- 0180 gave us fin_sell_inventory: it posts Dr COGS / Cr Inventory and decrements stock, under a row lock.
-- It is correct. And it was OPTIONAL.
--
-- Nothing forced an invoice to call it. A user could issue an invoice — revenue posted, AR debited, books
-- balanced — and never touch the inventory ledger. The company would then report a 100% GROSS MARGIN on
-- that sale. Stock would sit on the balance sheet as an asset it no longer owns. Every profitability,
-- break-even and unit-economics page would read that margin and be confidently, catastrophically wrong.
--
-- And the trial balance would tie out to the penny, because nothing about the entry is unbalanced. It is
-- simply INCOMPLETE — and an incomplete double-entry is invisible to double-entry's own guarantee.
--
-- The two halves of a sale must not be separable by an act of forgetfulness. So:
--
--   REVENUE AND ITS COST NOW POST IN THE SAME TRANSACTION, OR NEITHER POSTS.
--
-- ── WHAT THIS MEANS FOR A SALE WITH INSUFFICIENT STOCK ───────────────────────────────────────
--
-- fin_sell_inventory RAISES when stock is short. Because it is now called inside fin_issue_invoice, that
-- raise ABORTS THE WHOLE INVOICE. The revenue does not post either.
--
-- That is deliberate, and it is the harder choice. The softer one — post the revenue, skip the COGS, warn
-- somebody — is precisely the bug this migration exists to remove. An invoice you cannot cost is an invoice
-- whose margin you do not know, and posting it anyway means posting a number the system knows to be a lie.
--
-- Idempotent (§A12). NOT VERIFIED against a live database. BUILT, not TESTED.

-- ─── The link: an invoice line may name an inventory item ─────────────
-- Nullable, so a services business is entirely unaffected: a line with no item_id posts revenue and no
-- COGS, exactly as it does today. This adds a capability; it removes nothing.
alter table fin_invoice_lines add column if not exists item_id uuid references fin_inventory_items(id) on delete restrict;
alter table fin_invoice_lines add column if not exists qty     numeric(19,4);

-- A line that names an item MUST say how many. Otherwise the COGS call has no quantity, and a NULL would
-- silently cost the sale at zero — reinstating the exact bug, more subtly.
alter table fin_invoice_lines drop constraint if exists fin_inv_line_item_qty_ck;
alter table fin_invoice_lines add constraint fin_inv_line_item_qty_ck
  check (item_id is null or (qty is not null and qty > 0));

-- ─── fin_issue_invoice now posts BOTH halves, or neither ──────────────
-- Replaces the 0131 definition. The revenue path is UNCHANGED, character for character — this only appends
-- the COGS step. A services invoice behaves exactly as it did before.
create or replace function fin_issue_invoice(p_invoice_id uuid)
returns uuid language plpgsql
security definer set search_path = public as $$
declare
  v_company uuid; v_status text; v_ccy char(3); v_date date; v_creator uuid;
  v_period uuid; v_ar uuid; v_taxpay uuid; v_lines jsonb; v_tax numeric(19,4); v_grand numeric(19,4); v_entry uuid;
  v_line record;
begin
  if not fin_can_approve() then raise exception 'Not authorized to issue invoices'; end if;
  select company_id, status, currency, invoice_date, created_by
    into v_company, v_status, v_ccy, v_date, v_creator
    from fin_invoices where id = p_invoice_id;
  if v_company is null or v_company <> auth_company_id() then raise exception 'Invoice not found in your company'; end if;
  if v_status <> 'draft' then raise exception 'Only a draft invoice can be issued (current: %)', v_status; end if;
  if v_creator = auth.uid() then raise exception 'Segregation of duties: you cannot issue an invoice you created'; end if;

  select id into v_period from fin_periods
    where company_id = v_company and status = 'open' and v_date between start_date and end_date
    order by start_date desc limit 1;
  if v_period is null then raise exception 'No OPEN period covers the invoice date %', v_date; end if;

  v_ar     := fin_account_by_code(v_company, '1100');   -- Accounts Receivable
  v_taxpay := fin_account_by_code(v_company, '2100');   -- Taxes Payable (output tax)
  if v_ar is null then raise exception 'Accounts Receivable account (1100) missing — initialize finance'; end if;

  -- Cr each revenue line; sum tax + grand total.  [UNCHANGED from 0131]
  select coalesce(jsonb_agg(jsonb_build_object(
           'account_id', revenue_account_id, 'debit', 0, 'credit', amount, 'currency', v_ccy,
           'memo', coalesce(description,'')) order by line_no), '[]'::jsonb),
         coalesce(sum(tax_amount),0),
         coalesce(sum(amount + tax_amount),0)
    into v_lines, v_tax, v_grand
    from fin_invoice_lines where invoice_id = p_invoice_id;
  if jsonb_array_length(v_lines) = 0 then raise exception 'Invoice has no lines'; end if;

  if v_tax > 0 then
    if v_taxpay is null then raise exception 'Taxes Payable account (2100) missing'; end if;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'account_id', v_taxpay, 'debit', 0, 'credit', v_tax, 'currency', v_ccy, 'memo', 'Output tax'));
  end if;
  v_lines := v_lines || jsonb_build_array(jsonb_build_object(
    'account_id', v_ar, 'debit', v_grand, 'credit', 0, 'currency', v_ccy, 'memo', 'Accounts Receivable'));

  v_entry := fin_post_system_entry(v_company, v_date, v_period,
    'Invoice ' || (select invoice_number from fin_invoices where id = p_invoice_id), 'ar', v_lines);
  insert into fin_source_postings (company_id, source_type, source_id, entry_id, kind)
    values (v_company, 'ar_invoice', p_invoice_id, v_entry, 'issue');
  update fin_invoices set status = 'sent', issued_by = auth.uid(), issued_at = now(),
    posted_entry_id = v_entry where id = p_invoice_id;

  -- ── NEW: THE COST OF WHAT WAS SOLD ──────────────────────────────────
  -- Same transaction as the revenue above. If any of these RAISE — insufficient stock, most likely — the
  -- ENTIRE invoice rolls back, revenue included. The two halves of a sale cannot be separated by an act of
  -- forgetfulness, and they cannot be half-committed by an error either.
  --
  -- fin_sell_inventory takes its own row lock per item, so two invoices selling the last unit of the same
  -- SKU serialize correctly: one succeeds, the other aborts in full.
  for v_line in
    select item_id, qty from fin_invoice_lines
     where invoice_id = p_invoice_id and item_id is not null
  loop
    perform fin_sell_inventory(v_line.item_id, v_line.qty, v_period,
                               'Invoice ' || (select invoice_number from fin_invoices where id = p_invoice_id));
  end loop;

  return v_entry;
end $$;

-- ─── Which invoices sold stock without costing it? ────────────────────
-- A backstop for anything issued BEFORE this migration, or through any path that bypassed it. It should
-- always be empty. If it is not, those invoices are carrying a 100% gross margin, and every analytics page
-- in the product is reading it.
create or replace view fin_invoices_missing_cogs with (security_invoker = true) as
  select i.company_id,
         i.id as invoice_id,
         i.invoice_number,
         i.invoice_date,
         count(l.id) as stock_lines
    from fin_invoices i
    join fin_invoice_lines l on l.invoice_id = i.id and l.item_id is not null
   where i.status in ('sent','paid')
     and not exists (
       select 1 from fin_inventory_movements m
        where m.kind = 'sale'
          and m.reason = 'Invoice ' || i.invoice_number
     )
   group by i.company_id, i.id, i.invoice_number, i.invoice_date;
