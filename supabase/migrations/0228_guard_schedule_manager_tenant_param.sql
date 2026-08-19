-- 0228 — harden auth_is_schedule_manager (0227): guard its tenant parameter against auth_company_id().
--
-- invariant-audit INVARIANT 4: a SECURITY DEFINER function that takes a company id as a PARAMETER must guard
-- it against the caller's own company (or be revoked), because PostgREST exposes it as a client-callable RPC
-- and a DEFINER function bypasses RLS. 0227's `auth_is_schedule_manager(p_company)` was functionally safe (it
-- returns true only when the caller's OWN profile has company_id = p_company AND an admin role, so a mismatched
-- tenant id yields false, never a leak), but the PATTERN must be explicitly gated — a future edit could widen
-- it. Add the explicit `p_company = auth_company_id()` guard so a direct client call with another tenant's id
-- can never even reach the role check.
--
-- Same signature as 0227's helper → this REPLACES it (no new overload; the single-overload posture is
-- unaffected). The two schedule write RPCs (append_schedule_event, apply_schedule_import) call it unchanged;
-- they pass v_company = auth_company_id(), so the guard is always satisfied for legitimate internal calls and
-- only ever blocks a direct client call that supplies a foreign company id.

create or replace function auth_is_schedule_manager(p_company uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_company = auth_company_id() and exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and p.company_id = p_company
      and p.role in ('CEO', 'COO', 'admin')
  );
$$;
