-- 0153 — Financial System fix: row-lock the remaining read-guard-post functions (concurrency).
--
-- Completes the row-lock sweep (§1.2) started in 0147 (approve-bill/issue-invoice/approve-expense) and
-- 0152 (issue-credit-note). Two more applied functions read a document's status, check it, then
-- post/create WITHOUT `for update`, so concurrent callers can both pass the guard and act twice:
--
--   • fin_reimburse_expense_report (0125) — posts the cash-out (Dr 2200 / Cr cash). Two concurrent
--     reimbursements of the same approved report → the employee is PAID TWICE.
--   • fin_convert_po_to_bill (0139) — inserts a draft bill from the PO. Two concurrent converts →
--     TWO bills from one PO (double liability once both are approved).
--
-- Fix: add `for update` to each document select, matching pay/receipt (0127/0132), the posting path
-- (0147), and credit notes (0152). The second caller now blocks until the first commits, then reads
-- the non-'approved' / 'converted' status and raises. Bodies otherwise verbatim. Idempotent (create or
-- replace). These are in applied migrations (0125/0139), hence this new migration rather than in-place.
--
-- (fin_run_due_recurring (0140) is the same class but a dormant single-runner batch — noted, not
-- changed here; if it's ever wired to a concurrent cron, add `for update skip locked` to its template
-- select so two runners can't double-generate the same due bill.)

create or replace function fin_reimburse_expense_report(p_report_id uuid, p_cash_code text default '1000')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_company uuid; v_status text; v_base char(3); v_period uuid; v_pay uuid; v_cash uuid; v_total numeric(19,4); v_entry uuid;
begin
  if not fin_can_approve() then raise exception 'Not authorized to reimburse'; end if;
  -- for update: serialize concurrent reimbursements so the same report can't be paid out twice (0153).
  select company_id, status into v_company, v_status from fin_expense_reports where id = p_report_id for update;
  if v_company is null or v_company <> auth_company_id() then raise exception 'Report not found in your company'; end if;
  if v_status <> 'approved' then raise exception 'Only an approved report can be reimbursed (current: %)', v_status; end if;

  select base_currency into v_base from fin_settings where company_id = v_company;
  select id into v_period from fin_periods where company_id = v_company and status = 'open'
    and current_date between start_date and end_date order by start_date desc limit 1;
  if v_period is null then raise exception 'No OPEN period covers today'; end if;

  v_pay  := fin_account_by_code(v_company, '2200');
  v_cash := fin_account_by_code(v_company, p_cash_code);
  if v_pay is null or v_cash is null then raise exception 'Payable (2200) or cash (%) account missing', p_cash_code; end if;
  select coalesce(sum(amount + tax_amount),0) into v_total from fin_expense_items where report_id = p_report_id;

  v_entry := fin_post_system_entry(v_company, current_date, v_period,
    'Reimbursement: ' || (select title from fin_expense_reports where id = p_report_id), 'payment',
    jsonb_build_array(
      jsonb_build_object('account_id', v_pay,  'debit', v_total, 'credit', 0, 'currency', v_base, 'memo', 'Reimbursement settled'),
      jsonb_build_object('account_id', v_cash, 'debit', 0, 'credit', v_total, 'currency', v_base, 'memo', 'Cash out')
    ));
  insert into fin_source_postings (company_id, source_type, source_id, entry_id, kind)
    values (v_company, 'expense_report', p_report_id, v_entry, 'payment');
  update fin_expense_reports set status = 'reimbursed', reimbursed_at = now() where id = p_report_id;
  return v_entry;
end $$;

create or replace function fin_convert_po_to_bill(p_po_id uuid, p_bill_number text, p_bill_date date)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_company uuid; v_status text; v_vendor uuid; v_bill uuid;
begin
  if not fin_can_enter() then raise exception 'Not authorized to convert purchase orders'; end if;
  -- for update: serialize concurrent conversions so one PO can't spawn two bills (0153).
  select company_id, status, vendor_id into v_company, v_status, v_vendor from fin_purchase_orders where id = p_po_id for update;
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
