-- 0128 — Financial System security/integrity fix: AP bills are client-editable only while DRAFT
--
-- Adversarial audit caught the AP analogue of the expense-items hole (fixed in 0125): fin_bills +
-- fin_bill_lines write policies were plain fin_can_enter() with NO status restriction. So after a
-- bill was approved (its GL entry posted), an accountant could still edit/add/delete its lines via
-- direct PostgREST — making the bill DISAGREE with its posted journal entry — or revert an
-- approved/paid bill's status. Status transitions must go only through the RPCs (fin_approve_bill /
-- fin_pay_bill, SECURITY DEFINER); clients may only touch DRAFTS.
--
-- Idempotent (drop/create policy).

-- fin_bills: insert + edit + delete only DRAFTS. Approved/paid/void are client-immutable.
drop policy if exists "fin_bills - write" on fin_bills;
drop policy if exists "fin_bills - insert" on fin_bills;
create policy "fin_bills - insert" on fin_bills
  for insert with check (company_id = auth_company_id() and fin_can_enter() and status = 'draft');
drop policy if exists "fin_bills - update draft" on fin_bills;
create policy "fin_bills - update draft" on fin_bills
  for update using (company_id = auth_company_id() and fin_can_enter() and status = 'draft')
  with check (company_id = auth_company_id() and fin_can_enter() and status = 'draft');
drop policy if exists "fin_bills - delete draft" on fin_bills;
create policy "fin_bills - delete draft" on fin_bills
  for delete using (company_id = auth_company_id() and fin_can_enter() and status = 'draft');

-- fin_bill_lines: writable only while the parent bill is a DRAFT.
drop policy if exists "fin_bill_lines - write" on fin_bill_lines;
drop policy if exists "fin_bill_lines - write draft" on fin_bill_lines;
create policy "fin_bill_lines - write draft" on fin_bill_lines
  for all using (
    company_id = auth_company_id() and fin_can_enter()
    and exists (select 1 from fin_bills b where b.id = bill_id and b.status = 'draft'))
  with check (
    company_id = auth_company_id() and fin_can_enter()
    and exists (select 1 from fin_bills b where b.id = bill_id and b.status = 'draft'));

-- (SELECT policies from 0123 are unchanged — finance-view can read all bills/lines.)
