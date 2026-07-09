-- 0107 — tenant-key push-out class: close the last two residuals (notification_subscriptions,
--        care_agent_state) found by re-sweeping the class to its boundary.
--
-- Why
-- ───
-- Applying A26's "check every candidate against ALL open classes" refinement to resolutions
-- (0105) revealed resolutions had ALSO been missed by the tenant-key push-out class (0095/0101/
-- 0102) — a signal that class's boundary was BELIEVED complete but never exhaustively verified.
-- A full re-sweep of every company_id table's member-reachable UPDATE path (2026-07-09) confirmed
-- 38 tables SAFE (no member UPDATE, or company_id pinned in with-check, or a company_id freeze
-- trigger) and found exactly TWO residuals:
--
--   1. notification_subscriptions (0029:70) — `update_own` is
--        using (user_id = auth.uid()) with check (user_id = auth.uid())
--      The with-check pins only user_id, and there is NO freeze trigger. An owner can
--      `UPDATE ... SET company_id = <foreign>` on their own row (user_id unchanged → passes),
--      relocating it cross-tenant. Practical blast radius is limited (the push fan-out queries by
--      user_id, not company_id) but it is the exact push-out shape, and any company_id-scoped
--      count/query over this table would be corrupted. Verified safe to pin: the only writer
--      (subscribe/route.ts:79) always upserts company_id = getCurrentCompanyId() = the caller's
--      own company, so `company_id = auth_company_id()` passes every legit path.
--
--   2. care_agent_state (0095:160) — the 0095 hardening added a with-check + a guard trigger, but
--      the guard (guard_care_agent_state_admin_cols) freezes only max_concurrent / channels for a
--      self-updating agent, and the self-update with-check pins only agent_id. So an agent can
--      `UPDATE care_agent_state SET company_id = <foreign> WHERE agent_id = auth.uid()` — passes
--      the with-check (agent_id unchanged) and the guard (company_id not checked). This injects/
--      removes the agent from a tenant's routing pool (routeNewConversation reads state by
--      company_id). 0095 shipped the with-check but froze the WRONG columns for THIS vector.
--      company_id is the agent's tenant key — it must never change for ANY authenticated caller
--      (agent OR admin), so the freeze belongs BEFORE the admin bypass. Service-role pipelines
--      (current_user not in authenticated/anon) still pass untouched.
--
-- Ripple-traced (§1.5): pinning notification_subscriptions.company_id blocks only a foreign value,
-- not the always-own-company upsert; freezing care_agent_state.company_id blocks only a change,
-- and no legit path changes it (agents set status/last_seen; admins set max_concurrent/channels).
-- §A12 idempotent. STATUS: UNAPPLIED — founder applies alongside the 0102-0106 authz queue.

-- ── 1. notification_subscriptions — pin company_id on the owner UPDATE ─────────
drop policy if exists notification_subscriptions_update_own on notification_subscriptions;
create policy notification_subscriptions_update_own
  on notification_subscriptions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and company_id = auth_company_id());

-- ── 2. care_agent_state — freeze company_id for all authenticated callers ──────
create or replace function guard_care_agent_state_admin_cols()
returns trigger language plpgsql as $$
begin
  -- Service-role / definer context passes untouched (pipelines, admin routes).
  if current_user not in ('authenticated', 'anon') then
    return NEW;
  end if;
  -- Added by 0107: company_id is the agent's tenant key — immutable for ANY authenticated
  -- caller (agent OR admin). Checked BEFORE the admin bypass so an admin can't relocate it
  -- cross-tenant either. (The tenant-key push-out class; 0095 froze only the capacity columns.)
  if NEW.company_id is distinct from OLD.company_id then
    raise exception 'care_agent_state.company_id is immutable';
  end if;
  -- A company admin may change the admin-controlled columns.
  if exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and p.company_id = OLD.company_id
      and p.role in ('CEO', 'COO', 'admin')
  ) then
    return NEW;
  end if;
  -- Otherwise (an agent self-updating) the capacity columns are frozen; status /
  -- last_seen_at remain freely settable.
  if NEW.max_concurrent is distinct from OLD.max_concurrent then
    raise exception 'care_agent_state.max_concurrent is admin-managed, not agent-settable';
  end if;
  if NEW.channels is distinct from OLD.channels then
    raise exception 'care_agent_state.channels is admin-managed, not agent-settable';
  end if;
  return NEW;
end $$;
-- (trigger from 0095 already binds this function; recreating the function suffices.)
