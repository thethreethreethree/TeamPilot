-- 0142 — SECURITY (MED-HIGH): pin created_by on the subledger document tables (author-spoof / SoD bypass).
--
-- Finding (audit 2026-07-13, author-spoof class — same as 0103-0106, now in the finance tables that
-- postdate that sweep): fin_journal_entries correctly pins its author (RLS `created_by = auth.uid()`
-- + column `default auth.uid()`, 0118), and fin_expense_reports pins `employee_user_id = auth.uid()`
-- (0125). But the subledger DOCUMENT tables — fin_bills (0123/0128), fin_invoices (0131),
-- fin_purchase_orders (0139) — have `created_by` with NO default and NO RLS pin; their INSERT policies
-- check only `company_id + fin_can_enter + status='draft'`. So a user with a direct Supabase client
-- can INSERT a draft with `created_by = <someone else>`.
--
-- Why it matters (not cosmetic): the approval SoD is `creator <> approver` (fin_approve_bill 0130,
-- fin_issue_invoice 0131, fin_approve_po 0139). A user who legitimately holds BOTH enter and approve
-- (controller/CFO) could insert a bill with a spoofed `created_by`, then approve it themselves — the
-- SoD check reads the spoofed creator, sees creator <> approver, and PASSES. That defeats segregation
-- of duties on GL-posting documents, a core control the spec requires.
--
-- Fix: mirror the ledger — pin `created_by = auth.uid()` in the INSERT with-check AND default the
-- column to auth.uid(). The SECURITY DEFINER helpers (fin_convert_po_to_bill, fin_generate_recurring_bill)
-- run as owner (bypass RLS) and already set created_by = auth.uid(), so they are unaffected; the API
-- routes already send created_by = auth.user.id, so they satisfy the pin. Idempotent (drop-before-create;
-- set-default is idempotent).

-- Column defaults (defense in depth — matches fin_journal_entries).
alter table fin_bills            alter column created_by set default auth.uid();
alter table fin_invoices         alter column created_by set default auth.uid();
alter table fin_purchase_orders  alter column created_by set default auth.uid();

-- RLS pins (the essential control — closes the direct-client spoof path).
drop policy if exists "fin_bills - insert" on fin_bills;
create policy "fin_bills - insert" on fin_bills
  for insert with check (
    company_id = auth_company_id() and fin_can_enter() and status = 'draft'
    and created_by = auth.uid()
  );

drop policy if exists "fin_invoices - insert" on fin_invoices;
create policy "fin_invoices - insert" on fin_invoices
  for insert with check (
    company_id = auth_company_id() and fin_can_enter() and status = 'draft'
    and created_by = auth.uid()
  );

drop policy if exists "fin_po - insert" on fin_purchase_orders;
create policy "fin_po - insert" on fin_purchase_orders
  for insert with check (
    company_id = auth_company_id() and fin_can_enter() and status = 'draft'
    and created_by = auth.uid()
  );

-- Note: fin_vendors/fin_customers also carry created_by, but no SoD or authority depends on it there
-- (it's informational attribution), so those are left as-is — pinning them is optional hardening, not
-- a control fix. fin_bill_lines/fin_invoice_lines/fin_po_lines have no author column.

-- ── UPDATE-path freeze (the INSERT pin above is not enough on its own) ──
-- The draft-UPDATE policies (0128/0131/0139) let ANY fin_can_enter user edit ANY draft and do NOT
-- freeze created_by — so the SoD bypass reopens: insert a clean draft (created_by = self, passes the
-- pin), then UPDATE created_by = victim, then self-approve (creator = victim <> approver). The same
-- hole exists on fin_journal_entries drafts (manual-post SoD: fin_post_entry checks approved_by <>
-- created_by). fin_expense_reports is already safe (its UPDATE with-check pins employee_user_id =
-- auth.uid()). Freeze created_by after insert with a trigger, so no update path can re-attribute it.
create or replace function fin_freeze_created_by()
returns trigger language plpgsql set search_path = public as $$
begin
  if OLD.created_by is distinct from NEW.created_by then
    raise exception 'created_by is immutable (segregation-of-duties author cannot be reassigned)';
  end if;
  return NEW;
end $$;

drop trigger if exists fin_freeze_creator on fin_bills;
create trigger fin_freeze_creator before update on fin_bills
  for each row execute function fin_freeze_created_by();
drop trigger if exists fin_freeze_creator on fin_invoices;
create trigger fin_freeze_creator before update on fin_invoices
  for each row execute function fin_freeze_created_by();
drop trigger if exists fin_freeze_creator on fin_purchase_orders;
create trigger fin_freeze_creator before update on fin_purchase_orders
  for each row execute function fin_freeze_created_by();
drop trigger if exists fin_freeze_creator on fin_journal_entries;
create trigger fin_freeze_creator before update on fin_journal_entries
  for each row execute function fin_freeze_created_by();
