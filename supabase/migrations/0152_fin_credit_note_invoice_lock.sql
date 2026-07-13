-- 0152 — Financial System fix: fin_issue_credit_note must LOCK the invoice row (concurrency).
--
-- Bug (found by a §1.2 sweep of the row-lock discipline): fin_pay_bill (0127) and fin_record_receipt
-- (0132) both `select … for update` the bill/invoice before computing the remaining balance, so
-- concurrent settlements serialize and can't over-apply. fin_issue_credit_note (0143) read the invoice
-- WITHOUT `for update` — yet it too reduces the invoice's outstanding and enforces an over-credit guard
-- off `v_prior` (already-issued credits). So two credit notes issued concurrently against the same
-- invoice both read the same v_prior, both pass `v_grand > v_outstanding`, and both post → the invoice
-- is OVER-CREDITED (AR over-reduced / contra-revenue over-posted). Rare (needs concurrent issuance of
-- two drafts against one invoice) but a real financial-integrity hole under load / double-submit.
--
-- Fix: add `for update` to the invoice select, exactly as pay/receipt do. Concurrent credit-note issues
-- against the same invoice now serialize on the invoice row lock; the second sees the first's committed
-- credit in v_prior and the over-credit guard holds. Only line 77's select changes; rest is 0143 verbatim.
-- SECURITY DEFINER + SoD + draft-lock + created_by freeze all unchanged. Idempotent (create or replace).

create or replace function fin_issue_credit_note(p_credit_note_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_company uuid; v_status text; v_date date; v_creator uuid; v_invoice uuid;
  v_ccy char(3); v_period uuid; v_ar uuid; v_taxpay uuid; v_returns uuid;
  v_lines jsonb; v_tax numeric(19,4); v_grand numeric(19,4);
  v_inv_total numeric(19,4); v_received numeric(19,4); v_prior numeric(19,4); v_outstanding numeric(19,4);
  v_inv_status text; v_entry uuid;
begin
  if not fin_can_approve() then raise exception 'Not authorized to issue credit notes'; end if;
  select company_id, status, credit_date, created_by, invoice_id
    into v_company, v_status, v_date, v_creator, v_invoice
    from fin_credit_notes where id = p_credit_note_id;
  if v_company is null or v_company <> auth_company_id() then raise exception 'Credit note not found in your company'; end if;
  if v_status <> 'draft' then raise exception 'Only a draft credit note can be issued (current: %)', v_status; end if;
  -- Segregation of duties: the person who entered it cannot issue it.
  if v_creator = auth.uid() then raise exception 'Segregation of duties: you cannot issue a credit note you created'; end if;

  -- The invoice must be issued (has a receivable to reduce). FOR UPDATE: serialize concurrent
  -- credit-note issues against the same invoice so the over-credit guard below can't be raced (0152).
  select status, currency into v_inv_status, v_ccy from fin_invoices where id = v_invoice for update;
  if v_inv_status is null then raise exception 'Linked invoice not found'; end if;
  if v_inv_status <> 'sent' then raise exception 'Credit notes apply to an issued (sent) invoice with an open balance (invoice is %)', v_inv_status; end if;

  select id into v_period from fin_periods
    where company_id = v_company and status = 'open' and v_date between start_date and end_date
    order by start_date desc limit 1;
  if v_period is null then raise exception 'No OPEN period covers the credit date %', v_date; end if;

  -- Over-credit guard: the new credit cannot exceed the invoice's current outstanding.
  v_inv_total := (select coalesce(sum(amount + tax_amount),0) from fin_invoice_lines where invoice_id = v_invoice);
  v_received  := (select coalesce(sum(amount),0) from fin_receipts where invoice_id = v_invoice);
  v_prior     := (select coalesce(sum(cl.amount + cl.tax_amount),0)
                    from fin_credit_note_lines cl join fin_credit_notes cn on cn.id = cl.credit_note_id
                    where cn.invoice_id = v_invoice and cn.status = 'issued');
  v_outstanding := v_inv_total - v_received - v_prior;

  select coalesce(sum(amount + tax_amount),0), coalesce(sum(tax_amount),0)
    into v_grand, v_tax
    from fin_credit_note_lines where credit_note_id = p_credit_note_id;
  if v_grand <= 0 then raise exception 'Credit note has no lines / zero amount'; end if;
  if v_grand > v_outstanding then
    raise exception 'Credit (%.2f) exceeds the invoice outstanding (%.2f)', v_grand, v_outstanding;
  end if;

  -- Resolve-or-create the contra-revenue + control accounts.
  v_ar     := fin_account_by_code(v_company, '1100');
  v_taxpay := fin_account_by_code(v_company, '2100');
  v_returns := fin_account_by_code(v_company, '4900');
  if v_returns is null then
    insert into fin_accounts (company_id, code, name, type, normal_balance, is_system)
      values (v_company, '4900', 'Sales Returns & Allowances', 'revenue', 'credit', true)
      returning id into v_returns;
  end if;
  if v_ar is null then raise exception 'Accounts Receivable (1100) missing — initialize finance'; end if;

  -- Dr 4900 Sales Returns for the net line amount (reduces revenue).
  v_lines := jsonb_build_array(jsonb_build_object(
    'account_id', v_returns, 'debit', (v_grand - v_tax), 'credit', 0, 'currency', v_ccy, 'memo', 'Sales returns/allowance'));
  -- Dr Tax Payable to reverse the output tax originally charged.
  if v_tax > 0 then
    if v_taxpay is null then raise exception 'Taxes Payable (2100) missing'; end if;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'account_id', v_taxpay, 'debit', v_tax, 'credit', 0, 'currency', v_ccy, 'memo', 'Reverse output tax'));
  end if;
  -- Cr Accounts Receivable for the grand total (reduces what the customer owes).
  v_lines := v_lines || jsonb_build_array(jsonb_build_object(
    'account_id', v_ar, 'debit', 0, 'credit', v_grand, 'currency', v_ccy, 'memo', 'Accounts Receivable'));

  v_entry := fin_post_system_entry(v_company, v_date, v_period,
    'Credit note ' || (select credit_number from fin_credit_notes where id = p_credit_note_id), 'ar', v_lines);
  insert into fin_source_postings (company_id, source_type, source_id, entry_id, kind)
    values (v_company, 'ar_credit_note', p_credit_note_id, v_entry, 'issue');
  update fin_credit_notes set status = 'issued', issued_by = auth.uid(), issued_at = now(),
    posted_entry_id = v_entry where id = p_credit_note_id;
  return v_entry;
end $$;
