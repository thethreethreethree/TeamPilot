-- 0157 — PHASE 2 (remainder): Approval workflows with role-based SPEND LIMITS.
--
-- Spec: FinancialSystem.md §4 Phase 2 — "Approval workflows with role-based spend limits".
-- Confirmed data model (PHASE-2-DATA-MODEL.md): "Approval workflow + spend limits — role-based
-- thresholds on fin_roles (an approver can approve up to $X; above it escalates to controller/cfo)."
--
-- WHY fin_roles is the correct home (§A23 verified, not assumed)
-- ──────────────────────────────────────────────────────────────
-- approval_limit is an AUTHZ-BEARING column: it decides how much authority a user has. §A23 says such a
-- column must not be writable by the party it constrains, or the control is theatre. Checked before
-- building:
--   • fin_can_approve()   = role in ('approver','controller','cfo')   ← the roles the limit CONSTRAINS
--   • fin_can_configure() = role in ('controller','cfo')              ← the only roles that may WRITE fin_roles
--     (the "fin_roles - write" policy, 0116, is `for all using (… and fin_can_configure())`)
-- So a plain APPROVER cannot write fin_roles and therefore cannot raise their own ceiling. Only
-- controller/CFO can — and they are the escalation TARGET, i.e. they already outrank any limit, so
-- setting their own is not an escalation. The column is safe here. (Had `approver` held
-- fin_can_configure(), this design would have been a self-raisable limit and I would have had to store
-- the limit elsewhere.)
--
-- WHY a TRIGGER rather than re-declaring the approve RPCs (§2 explain-the-why, §3 DB-level)
-- ────────────────────────────────────────────────────────────────────────────────────────
-- The limit must be enforced at the DATABASE, not the API (§3: "enforce at the database level, not only
-- in application code"; §A23: "enforced at the API layer" is the marker of the escalation class).
-- Two ways to do that: (a) add the check inside fin_approve_bill / fin_approve_expense_report, or
-- (b) a BEFORE UPDATE trigger on the transition. I chose (b) deliberately:
--   1. Those RPCs are 40-line security-critical functions whose AUTHORITATIVE definition now lives in
--      0147 (it carries the `for update` row-lock AND the SoD check AND the cost-dimension threading).
--      `create or replace`-ing them from a hand-copied body risks SILENTLY DROPPING one of those guards —
--      the exact migration-coupling failure this project has been bitten by before. An additive trigger
--      cannot drop a guard that already exists.
--   2. A trigger binds EVERY path that flips a document to 'approved' — the RPC, a future RPC, a direct
--      PostgREST write, even service-role. The in-function check would only bind the one caller.
-- This is the same rule you confirmed, enforced at the layer that cannot be bypassed.
--
-- SEMANTICS
--   • approval_limit IS NULL  → unlimited (the default; controller/CFO are normally left NULL).
--   • approval_limit = X      → this user may approve documents whose TOTAL is <= X. Above it, the
--                               approval is REJECTED with an explicit "escalate" message. Escalation is
--                               therefore: a controller/CFO (or a higher-limit approver) approves it.
--   • The total compared is the document's gross total (amount + tax), computed in SQL in numeric(19,4)
--     — §3: never floating point for money.
--
-- Idempotent (add column if not exists; create or replace; drop trigger if exists) — §A12.
--
-- NOT VERIFIED against a live database (the agent has no DB access). Acceptance SQL ships in
-- docs/financial-system/tests/0157_spend_limits.test.sql. Status stays BUILT, not TESTED, until you run it.

-- ─── 1. The limit column ──────────────────────────────────────────────
alter table fin_roles
  add column if not exists approval_limit numeric(19,4);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'fin_roles_approval_limit_nonneg_ck'
  ) then
    alter table fin_roles
      add constraint fin_roles_approval_limit_nonneg_ck
      check (approval_limit is null or approval_limit >= 0);
  end if;
end $$;

comment on column fin_roles.approval_limit is
  'Max document total this user may approve. NULL = unlimited. Above it, approval raises and must escalate to controller/CFO. Authz-bearing: writable only by fin_can_configure() (controller/cfo) — an approver cannot raise their own ceiling (§A23).';

-- ─── 2. Shared limit lookup ───────────────────────────────────────────
-- Returns the approver's ceiling, or NULL for unlimited. SECURITY DEFINER because the trigger must read
-- fin_roles regardless of the caller's own row-level visibility of other users' roles.
create or replace function fin_approval_limit_for(p_company uuid, p_user uuid)
returns numeric(19,4)
language sql stable security definer set search_path = public as $$
  select approval_limit from fin_roles
   where company_id = p_company and user_id = p_user;
$$;

-- ─── 3. Bills: enforce on the draft → approved transition ─────────────
create or replace function fin_assert_bill_approval_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_total numeric(19,4); v_limit numeric(19,4);
begin
  -- Only the moment of approval matters; any other update passes through untouched.
  if NEW.status <> 'approved' or OLD.status = 'approved' then
    return NEW;
  end if;
  if NEW.approved_by is null then
    raise exception 'fin: a bill cannot be approved without an approver';
  end if;

  v_limit := fin_approval_limit_for(NEW.company_id, NEW.approved_by);
  if v_limit is null then
    return NEW;                                   -- unlimited
  end if;

  -- Gross total, in numeric — §3 (money math in SQL, never float).
  select coalesce(sum(amount + tax_amount), 0)
    into v_total from fin_bill_lines where bill_id = NEW.id;

  if v_total > v_limit then
    raise exception
      'Approval limit exceeded: bill total % is above your limit of % — escalate to a controller/CFO',
      v_total, v_limit;
  end if;
  return NEW;
end $$;

drop trigger if exists fin_bill_approval_limit_trg on fin_bills;
create trigger fin_bill_approval_limit_trg
  before update on fin_bills
  for each row execute function fin_assert_bill_approval_limit();

-- ─── 4. Expense reports: enforce on the submitted → approved transition ─
create or replace function fin_assert_expense_approval_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_total numeric(19,4); v_limit numeric(19,4);
begin
  if NEW.status <> 'approved' or OLD.status = 'approved' then
    return NEW;
  end if;
  if NEW.approved_by is null then
    raise exception 'fin: an expense report cannot be approved without an approver';
  end if;

  v_limit := fin_approval_limit_for(NEW.company_id, NEW.approved_by);
  if v_limit is null then
    return NEW;
  end if;

  select coalesce(sum(amount + tax_amount), 0)
    into v_total from fin_expense_items where report_id = NEW.id;

  if v_total > v_limit then
    raise exception
      'Approval limit exceeded: expense report total % is above your limit of % — escalate to a controller/CFO',
      v_total, v_limit;
  end if;
  return NEW;
end $$;

drop trigger if exists fin_expense_approval_limit_trg on fin_expense_reports;
create trigger fin_expense_approval_limit_trg
  before update on fin_expense_reports
  for each row execute function fin_assert_expense_approval_limit();
