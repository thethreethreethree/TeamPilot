-- 0162 — PHASE 2 (remainder): EXPENSE POLICY ENFORCEMENT (limits, disallowed categories, receipts).
--
-- Spec: FinancialSystem.md §4 Phase 2 — "Policy enforcement (limits, disallowed categories)".
--
-- §A27 IS THE WHOLE POINT OF THIS MIGRATION
-- "A surface that PROMISES an invariant the write path does not ENFORCE is a false guarantee." An expense
-- policy is exactly such a promise: the moment the UI says "meals are capped at 40" or "alcohol is not
-- reimbursable", the company believes a control exists. If that control lives only in the client — a
-- disabled button, a form validation — then a direct PostgREST call, a future route, or a bulk import
-- walks straight through it, and the policy is decoration. Worse than decoration: the reader TRUSTS it.
--
-- So the enforcement is a DATABASE TRIGGER on fin_expense_items. It binds every path that writes an
-- expense line — the app, a future importer, service-role, direct SQL. The UI may still disable the
-- button (good UX), but the UI is not what makes the policy true.
--
-- THREE RULES, all enforceable because the data exists to enforce them:
--   1. is_disallowed          → the category cannot be claimed at all.
--   2. max_amount             → a single line above the cap is rejected.
--   3. requires_receipt_above → above this amount a receipt is mandatory (fin_expense_items.receipt_url
--                               exists — VERIFIED in 0125, not assumed).
--
-- RESOLUTION ORDER: the most specific policy wins — a policy bound to the ACCOUNT beats one bound to the
-- CATEGORY string, which beats nothing. Effective-dated for the same reason as 0161's rates: tightening a
-- policy in March must not retroactively invalidate a January claim that was legitimate when made
-- (§3: records are append-only; history is not rewritten by a config change).
--
-- WHO MAY SET POLICY: fin_can_configure() (controller/CFO). An employee must not be able to raise the cap
-- their own claim is checked against — the same self-raisable-ceiling class as 0157's approval_limit
-- (§A23), and the reason that check is in this file rather than assumed.
--
-- Idempotent (§A12). NOT VERIFIED against a live database (no DB access). BUILT, not TESTED.

create table if not exists fin_expense_policies (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references companies(id) on delete cascade,
  -- Bind to an ACCOUNT (precise) and/or a CATEGORY string (loose). At least one must be present.
  account_id            uuid references fin_accounts(id) on delete cascade,
  category              text,
  effective_from        date not null default current_date,
  is_disallowed         boolean not null default false,
  max_amount            numeric(19,4) check (max_amount is null or max_amount >= 0),
  requires_receipt_above numeric(19,4) check (requires_receipt_above is null or requires_receipt_above >= 0),
  note                  text,
  is_active             boolean not null default true,
  created_by            uuid not null default auth.uid() references auth.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  constraint fin_exp_policy_target_ck check (account_id is not null or category is not null)
);
create index if not exists fin_exp_policy_acct_idx
  on fin_expense_policies (company_id, account_id, effective_from desc) where is_active;
create index if not exists fin_exp_policy_cat_idx
  on fin_expense_policies (company_id, category, effective_from desc) where is_active;

-- ─── Enforcement on the WRITE PATH (§A27) ─────────────────────────────
create or replace function fin_enforce_expense_policy()
returns trigger language plpgsql security definer set search_path = public as $$
declare p record; v_gross numeric(19,4);
begin
  -- The policy is checked against the GROSS line (what the company actually pays out), consistent with
  -- how 0157's approval limit is checked. A net-only check would let tax push a claim past its cap.
  v_gross := coalesce(NEW.amount, 0) + coalesce(NEW.tax_amount, 0);

  -- Most specific wins: an ACCOUNT-bound policy beats a CATEGORY-bound one. Effective as of the expense
  -- date (not today) so a later policy change does not retroactively break an older legitimate claim.
  select * into p
    from fin_expense_policies
   where company_id = NEW.company_id
     and is_active
     and effective_from <= coalesce(NEW.expense_date, current_date)
     and (
          (account_id is not null and account_id = NEW.account_id)
       or (account_id is null and category is not null and category = NEW.category)
     )
   order by (account_id is not null) desc, effective_from desc
   limit 1;

  if not found then
    return NEW;                                  -- no policy binds this line
  end if;

  if p.is_disallowed then
    raise exception 'Expense policy: % is not reimbursable', coalesce(NEW.category, 'this category');
  end if;

  if p.max_amount is not null and v_gross > p.max_amount then
    raise exception 'Expense policy: % exceeds the limit of % for %',
      v_gross, p.max_amount, coalesce(NEW.category, 'this category');
  end if;

  if p.requires_receipt_above is not null
     and v_gross > p.requires_receipt_above
     and (NEW.receipt_url is null or btrim(NEW.receipt_url) = '')
  then
    raise exception 'Expense policy: a receipt is required for amounts above %', p.requires_receipt_above;
  end if;

  return NEW;
end $$;

-- Fires AFTER 0161's amount-derivation trigger (alphabetical order on the same timing/event: 'fin_expense
-- _item_amount_trg' < 'fin_expense_policy_trg'), so mileage/per-diem lines are policed on their DERIVED
-- amount, not on whatever the client submitted. That ordering is load-bearing: policing a client-supplied
-- amount would be policing a number the claimant chose.
drop trigger if exists fin_expense_policy_trg on fin_expense_items;
create trigger fin_expense_policy_trg
  before insert or update on fin_expense_items
  for each row execute function fin_enforce_expense_policy();

-- ─── RLS: policy is CONFIGURE-level (§A23 — a claimant cannot raise their own cap) ──
alter table fin_expense_policies enable row level security;

drop policy if exists "fin_exp_policy - select" on fin_expense_policies;
create policy "fin_exp_policy - select" on fin_expense_policies
  for select using (company_id = auth_company_id() and fin_can_view());
drop policy if exists "fin_exp_policy - insert" on fin_expense_policies;
create policy "fin_exp_policy - insert" on fin_expense_policies
  for insert with check (company_id = auth_company_id() and fin_can_configure() and created_by = auth.uid());
drop policy if exists "fin_exp_policy - update" on fin_expense_policies;
create policy "fin_exp_policy - update" on fin_expense_policies
  for update using (company_id = auth_company_id() and fin_can_configure())
  with check (company_id = auth_company_id() and fin_can_configure());
drop policy if exists "fin_exp_policy - delete" on fin_expense_policies;
create policy "fin_exp_policy - delete" on fin_expense_policies
  for delete using (company_id = auth_company_id() and fin_can_configure());

drop trigger if exists fin_freeze_creator on fin_expense_policies;
create trigger fin_freeze_creator before update on fin_expense_policies
  for each row execute function fin_freeze_created_by();

drop trigger if exists fin_audit_trg on fin_expense_policies;
create trigger fin_audit_trg after insert or update or delete on fin_expense_policies
  for each row execute function fin_audit();
