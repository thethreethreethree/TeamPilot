-- 0130 — Financial System: bill approval gets source-document SoD (founder-confirmed 2026-07-12)
--
-- Audit flag resolved: fin_approve_bill let one approver create AND self-approve a bill (no
-- independent approval), inconsistent with expenses (employee ≠ approver). Add created_by <>
-- approver so a bill's creator cannot approve it — the same SoD the expense path enforces, and it
-- closes the "bypass manual-entry SoD by routing through AP" gap. Otherwise identical to 0123.
--
-- Idempotent (create or replace).

create or replace function fin_approve_bill(p_bill_id uuid)
returns uuid language plpgsql
security definer set search_path = public as $$
declare
  v_company uuid; v_status text; v_ccy char(3); v_date date; v_vendor uuid; v_creator uuid;
  v_period uuid; v_ap uuid; v_taxrec uuid; v_lines jsonb; v_tax numeric(19,4); v_entry uuid;
begin
  if not fin_can_approve() then raise exception 'Not authorized to approve bills'; end if;
  select company_id, status, currency, bill_date, vendor_id, created_by
    into v_company, v_status, v_ccy, v_date, v_vendor, v_creator
    from fin_bills where id = p_bill_id;
  if v_company is null or v_company <> auth_company_id() then raise exception 'Bill not found in your company'; end if;
  if v_status <> 'draft' then raise exception 'Only a draft bill can be approved (current: %)', v_status; end if;
  -- Source-document SoD: the person who entered the bill cannot approve it.
  if v_creator = auth.uid() then
    raise exception 'Segregation of duties: you cannot approve a bill you created';
  end if;

  select id into v_period from fin_periods
    where company_id = v_company and status = 'open' and v_date between start_date and end_date
    order by start_date desc limit 1;
  if v_period is null then raise exception 'No OPEN period covers the bill date %', v_date; end if;

  v_ap     := fin_account_by_code(v_company, '2000');
  v_taxrec := fin_account_by_code(v_company, '1200');
  if v_ap is null then raise exception 'Accounts Payable account (2000) missing — initialize finance'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'account_id', account_id, 'debit', amount, 'credit', 0, 'currency', v_ccy,
           'memo', coalesce(description,'')) order by line_no), '[]'::jsonb),
         coalesce(sum(tax_amount), 0)
    into v_lines, v_tax
    from fin_bill_lines where bill_id = p_bill_id;
  if jsonb_array_length(v_lines) = 0 then raise exception 'Bill has no lines'; end if;

  if v_tax > 0 then
    if v_taxrec is null then raise exception 'Tax Receivable account (1200) missing'; end if;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'account_id', v_taxrec, 'debit', v_tax, 'credit', 0, 'currency', v_ccy, 'memo', 'Input tax'));
  end if;
  v_lines := v_lines || jsonb_build_array(jsonb_build_object(
    'account_id', v_ap, 'debit', 0,
    'credit', (select coalesce(sum(amount + tax_amount),0) from fin_bill_lines where bill_id = p_bill_id),
    'currency', v_ccy, 'memo', 'Accounts Payable'));

  v_entry := fin_post_system_entry(v_company, v_date, v_period,
    'Bill ' || (select bill_number from fin_bills where id = p_bill_id), 'ap', v_lines);
  insert into fin_source_postings (company_id, source_type, source_id, entry_id, kind)
    values (v_company, 'ap_bill', p_bill_id, v_entry, 'issue');
  update fin_bills set status = 'approved', approved_by = auth.uid(), approved_at = now(),
    posted_entry_id = v_entry where id = p_bill_id;
  return v_entry;
end $$;
