-- 0090 — freeze the authz-bearing profile columns against direct PostgREST writes
--
-- CRITICAL (found by the 2026-07-07 onboarding/role-bootstrap audit, §1.7).
--
-- ROOT CAUSE. The base UPDATE policy on profiles (0001:110) is
--     create policy "own profile - update" on profiles
--       for update using (id = auth.uid());
-- It has USING (id = auth.uid()) and NO WITH CHECK. For an UPDATE, USING gates
-- WHICH rows a caller may change; WITH CHECK gates what the NEW row may contain.
-- With no WITH CHECK, Postgres leaves every column of the new row unconstrained,
-- so any authenticated user can rewrite their OWN row's role / company_id /
-- sales_coach_role / is_support_agent to ANY value with one direct PostgREST call:
--
--     PATCH /rest/v1/profiles?id=eq.<self>
--     { "role": "admin", "company_id": "<any-tenant-uuid>" }
--
-- The whole authorization model reads these columns straight from profiles
-- (auth_company_id(), getCurrentAuthContext().isAdmin, is_vendor_super_admin(),
-- the vendor/care/coach gates). So:
--   • company_id := the vendor tenant (a hardcoded, non-secret UUID) => vendor
--     super-admin — this DEFEATS 0089, whose predicate IS company_id.
--   • company_id := any customer tenant => full cross-tenant read/write, because
--     auth_company_id() trusts the self-set value. Same class as the vendor-CRM
--     CRITICAL fixed earlier this session, reached from the role-bootstrap root
--     instead of the route layer.
--
-- WHY A TRIGGER, NOT WITH CHECK. WITH CHECK cannot reference OLD, so it cannot
-- express "this column may not CHANGE." Detecting a change requires OLD vs NEW,
-- which only a BEFORE UPDATE trigger has. This mirrors the established
-- check_invitation_immutability() pattern (0008:50) — composed (§A16), not forked
-- — with one addition: profiles' privileged columns DO legitimately change, but
-- only through privileged writers, so the guard exempts the privileged context.
--
-- WHY A BLOCK-LIST (authenticated/anon), NOT AN ALLOW-LIST. The legitimate
-- writers are SECURITY DEFINER RPCs (complete_company_onboarding, accept_invitation
-- — run as their owner, not as an end-user role) and service-role admin routes.
-- The only roles that reach this table via direct PostgREST end-user writes are
-- 'authenticated' and 'anon'. Blocking exactly those two means the failure mode
-- of any misjudgement is "allow a privileged writer" (no regression) rather than
-- "block onboarding" (catastrophic). The attacker always arrives as
-- 'authenticated', so the exploit is closed either way.
--
-- COUPLED CODE CHANGE. The care-agent settings route wrote is_support_agent via
-- the USER (authenticated) client; that write is converted to service-role in the
-- same commit so this guard does not break it. (That conversion also fixes a
-- latent bug: under the user client + the self-only RLS policy, an admin could
-- previously only toggle their OWN is_support_agent, never a teammate's.)
--
-- Founder must APPLY this migration; the hole is open until then.

create or replace function guard_profile_privileged_columns()
returns trigger language plpgsql as $$
begin
  -- Privileged / definer / service-role context: the legitimate writers. Only
  -- direct PostgREST end-user requests arrive as 'authenticated' / 'anon'; a
  -- SECURITY DEFINER RPC runs as its owner and the service key runs as
  -- 'service_role'. Everything that is NOT an end-user role passes untouched, so
  -- onboarding / invite-accept / admin routes are never blocked.
  if current_user not in ('authenticated', 'anon') then
    return NEW;
  end if;

  -- Direct authenticated/anon write: the authz-bearing columns are frozen. A
  -- user may still edit their own non-privileged fields (full_name,
  -- learning_mode_enabled, status, …) — those are not touched here.
  if NEW.role is distinct from OLD.role then
    raise exception 'profiles.role is system-managed (set via onboarding / invite acceptance), not directly settable';
  end if;
  if NEW.company_id is distinct from OLD.company_id then
    raise exception 'profiles.company_id is system-managed (set via onboarding / invite acceptance), not directly settable';
  end if;
  if NEW.sales_coach_role is distinct from OLD.sales_coach_role then
    raise exception 'profiles.sales_coach_role is admin-managed, not directly settable';
  end if;
  if NEW.is_support_agent is distinct from OLD.is_support_agent then
    raise exception 'profiles.is_support_agent is admin-managed, not directly settable';
  end if;

  return NEW;
end $$;

drop trigger if exists profiles_guard_privileged on profiles;
create trigger profiles_guard_privileged
  before update on profiles
  for each row execute function guard_profile_privileged_columns();

comment on function guard_profile_privileged_columns() is
  'Freezes role/company_id/sales_coach_role/is_support_agent against direct authenticated/anon PostgREST writes (0001 UPDATE policy has no WITH CHECK). Privileged writers — SECURITY DEFINER RPCs and service-role routes — pass through. See 0090.';
