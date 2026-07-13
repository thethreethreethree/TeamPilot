-- 0168 — PHASE 9: APPROVAL DELEGATION (holiday cover, without handing over a password).
--
-- Built against the CONFIRMED Phase-9 model.
--
-- THE PROBLEM THIS SOLVES, AND THE ONE IT MUST NOT CREATE
-- A controller goes on leave. Bills still arrive. Today the only options are: nothing gets approved for
-- two weeks, or someone uses the controller's login. The second is what actually happens, and it destroys
-- the entire audit trail — every approval in that window is attributed to a person who was on a beach.
-- Segregation of duties, the approval limit, the whole control structure: all of it silently becomes
-- fiction, and the ledger records a lie that looks perfect.
--
-- So delegation exists to make the honest path the easy one: the approval is recorded as made by the
-- DELEGATE, under authority delegated by the controller, for a stated window.
--
-- ── §A23: THIS IS A PRIVILEGE-GRANTING TABLE, SO THE WRITE GATE IS THE WHOLE FEATURE ─────────
--
-- A delegation row GRANTS APPROVAL AUTHORITY to someone who does not have it. If a user can insert a row
-- saying "the CFO delegates to me", they have just made themselves a CFO. That is not a bug, it is
-- privilege escalation with an audit trail that endorses it.
--
-- Three defences, and each is load-bearing:
--   1. RLS INSERT requires `delegator_id = auth.uid()` — you may only delegate YOUR OWN authority. You
--      cannot mint a delegation FROM someone else TO yourself.
--   2. A CHECK forbids delegator = delegate. Self-delegation is meaningless and would only exist as an
--      attempt to launder a limit.
--   3. The delegator must actually HOLD approval authority at the moment of delegation (enforced in the
--      RPC): you cannot delegate what you do not have. Otherwise two viewers could delegate to each other
--      and manufacture an approver out of nothing.
--
-- ── WHAT IS DELEGATED, AND WHAT IS NOT ───────────────────────────────────────────────────────
-- Delegated:  the capability to approve, and the delegator's approval LIMIT (never more than it).
-- NOT delegated: segregation of duties. A delegate still cannot approve a document THEY created. SoD is a
--   property of the person acting, not of the authority they borrowed — and delegation must never become
--   the loophole that lets one person both raise and approve a bill. This is the single most important
--   line in this migration: the existing SoD checks compare against auth.uid(), which is the DELEGATE, so
--   they keep working unchanged. Nothing here weakens them.
--
-- Idempotent (§A12). NOT VERIFIED against a live database. BUILT, not TESTED.

create table if not exists fin_approval_delegations (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade,
  delegator_id uuid not null references auth.users(id) on delete cascade,  -- who is lending authority
  delegate_id  uuid not null references auth.users(id) on delete cascade,  -- who may act on it
  starts_on    date not null,
  ends_on      date not null,
  reason       text,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now(),

  -- Self-delegation is meaningless; it could only ever be an attempt to launder a limit.
  constraint fin_deleg_not_self_ck check (delegator_id <> delegate_id),
  constraint fin_deleg_window_ck   check (ends_on >= starts_on)
);
create index if not exists fin_deleg_active_idx
  on fin_approval_delegations (company_id, delegate_id, starts_on, ends_on)
  where revoked_at is null;

-- ─── Is this user acting under a live delegation right now? ───────────
create or replace function fin_delegated_from(p_user uuid)
returns setof uuid
language sql stable security definer set search_path = public as $$
  select d.delegator_id
    from fin_approval_delegations d
   where d.company_id  = auth_company_id()
     and d.delegate_id = p_user
     and d.revoked_at is null
     and current_date between d.starts_on and d.ends_on;
$$;

-- ─── Approval capability now includes borrowed authority ──────────────
-- Replaces the 0116 definition. The original semantics are preserved EXACTLY as the first branch; the
-- second branch adds delegated authority. A user with their own approver/controller/cfo role is
-- unaffected — this can only ever ADD capability to someone acting under a live delegation from someone
-- who genuinely holds it.
create or replace function fin_can_approve() returns boolean
  language sql stable security definer set search_path = public as $$
  select
    -- (a) their own role — unchanged from 0116
    fin_effective_role() in ('approver','controller','cfo')
    or
    -- (b) a live delegation FROM someone who actually holds approval authority. The delegator's role is
    --     re-checked HERE, at use time, not merely at grant time: if the controller is demoted while on
    --     leave, the borrowed authority must evaporate with it. A delegation is a pointer to someone's
    --     authority, never a snapshot of it.
    exists (
      select 1
        from fin_approval_delegations d
        join fin_roles r
          on r.company_id = d.company_id
         and r.user_id    = d.delegator_id
       where d.company_id  = auth_company_id()
         and d.delegate_id = auth.uid()
         and d.revoked_at is null
         and current_date between d.starts_on and d.ends_on
         and r.role in ('approver','controller','cfo')
    );
$$;

-- ─── The limit follows the authority, and never exceeds it ────────────
-- Replaces 0157's lookup. A delegate may approve up to the HIGHEST ceiling available to them: their own,
-- or any delegator's. Crucially it is never MORE than the delegator actually had — you cannot borrow more
-- authority than the lender possesses. NULL anywhere in that set means unlimited, and NULL wins, because
-- a delegation from an unlimited approver confers unlimited authority for the window.
create or replace function fin_approval_limit_for(p_company uuid, p_user uuid)
returns numeric(19,4)
language plpgsql stable security definer set search_path = public as $$
declare v_own numeric(19,4); v_has_own boolean; v_unlimited boolean; v_max numeric(19,4);
begin
  select approval_limit, true into v_own, v_has_own
    from fin_roles where company_id = p_company and user_id = p_user;

  -- Their own unlimited ceiling short-circuits everything.
  if v_has_own and v_own is null then
    return null;
  end if;

  -- Any live delegation from an UNLIMITED approver also confers unlimited authority.
  select exists (
    select 1
      from fin_approval_delegations d
      join fin_roles r on r.company_id = d.company_id and r.user_id = d.delegator_id
     where d.company_id  = p_company
       and d.delegate_id = p_user
       and d.revoked_at is null
       and current_date between d.starts_on and d.ends_on
       and r.role in ('approver','controller','cfo')
       and r.approval_limit is null
  ) into v_unlimited;

  if v_unlimited then
    return null;
  end if;

  -- Otherwise: the highest finite ceiling available — their own, or a delegator's.
  select max(lim) into v_max from (
    select v_own as lim where v_has_own
    union all
    select r.approval_limit
      from fin_approval_delegations d
      join fin_roles r on r.company_id = d.company_id and r.user_id = d.delegator_id
     where d.company_id  = p_company
       and d.delegate_id = p_user
       and d.revoked_at is null
       and current_date between d.starts_on and d.ends_on
       and r.role in ('approver','controller','cfo')
  ) s;

  return v_max;   -- NULL here means "no ceiling found at all" → no authority; the caller's own gate decides
end $$;

-- ─── Grant / revoke ───────────────────────────────────────────────────
create or replace function fin_delegate_approval(
  p_delegate_id uuid, p_starts date, p_ends date, p_reason text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_company uuid; v_id uuid;
begin
  v_company := auth_company_id();

  -- §A23: you may only delegate authority you actually hold. Without this, two viewers could delegate to
  -- each other and manufacture an approver out of nothing.
  if not (fin_effective_role() in ('approver','controller','cfo')) then
    raise exception 'You cannot delegate approval authority you do not have';
  end if;
  if p_delegate_id = auth.uid() then
    raise exception 'You cannot delegate to yourself';
  end if;
  if p_ends < p_starts then
    raise exception 'The delegation must end on or after it starts';
  end if;

  insert into fin_approval_delegations (company_id, delegator_id, delegate_id, starts_on, ends_on, reason)
    values (v_company, auth.uid(), p_delegate_id, p_starts, p_ends, p_reason)
    returning id into v_id;
  return v_id;
end $$;

create or replace function fin_revoke_delegation(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_delegator uuid; v_company uuid;
begin
  select delegator_id, company_id into v_delegator, v_company
    from fin_approval_delegations where id = p_id for update;
  if v_company is null or v_company <> auth_company_id() then
    raise exception 'Delegation not found in your company';
  end if;
  -- The lender may take it back; so may a controller/CFO (someone must be able to end it if the delegator
  -- is unreachable — which is, after all, the situation delegation exists for).
  if v_delegator <> auth.uid() and not fin_can_configure() then
    raise exception 'Only the person who delegated, or a controller/CFO, may revoke it';
  end if;
  update fin_approval_delegations set revoked_at = now() where id = p_id and revoked_at is null;
end $$;

-- ─── RLS: the write gate IS the feature (§A23) ────────────────────────
alter table fin_approval_delegations enable row level security;

drop policy if exists "fin_deleg - select" on fin_approval_delegations;
create policy "fin_deleg - select" on fin_approval_delegations
  for select using (company_id = auth_company_id() and fin_can_view());

-- You may ONLY create a delegation FROM YOURSELF. This single predicate is what stops a member inserting
-- "the CFO delegates to me" and becoming a CFO with an audit trail that endorses it.
drop policy if exists "fin_deleg - insert" on fin_approval_delegations;
create policy "fin_deleg - insert" on fin_approval_delegations
  for insert with check (company_id = auth_company_id() and delegator_id = auth.uid());

-- Revocation goes through the RPC (which checks who may revoke). No direct update path.
drop policy if exists "fin_deleg - delete" on fin_approval_delegations;
create policy "fin_deleg - delete" on fin_approval_delegations
  for delete using (company_id = auth_company_id() and fin_can_configure());

drop trigger if exists fin_audit_trg on fin_approval_delegations;
create trigger fin_audit_trg after insert or update or delete on fin_approval_delegations
  for each row execute function fin_audit();
