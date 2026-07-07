-- 0091 — extend the profiles privileged-column guard to INSERT
--
-- Follow-up to 0090 (same audit, 2026-07-07). 0090 froze the four authz-bearing
-- columns against direct authenticated UPDATE. This closes the INSERT side of the
-- same class.
--
-- THE INSERT VECTOR. The profiles INSERT policy (0001) is
--     for insert with check (id = auth.uid());
-- Its WITH CHECK constrains only id — NOT role / company_id / sales_coach_role /
-- is_support_agent. A profile row normally already exists for every user
-- (handle_new_user runs synchronously on signup, and there is no DELETE policy on
-- profiles, so the row cannot be removed), which makes a second insert a PK
-- conflict. But that is defense-by-circumstance, not by design. If a row is ever
-- absent (a failed/rolled-back bootstrap), a single direct call escalates:
--     INSERT INTO profiles (id, company_id) VALUES (auth.uid(), '<any-tenant>');
-- and because role DEFAULTS to 'CEO' (0001:27), even OMITTING role lands an admin
-- role — the default is applied before the BEFORE trigger fires, so NEW.role sees
-- it. company_id := the vendor tenant then yields vendor super-admin; any tenant
-- yields cross-tenant access. Identical impact to the 0090 UPDATE vector.
--
-- FIX. Redefine the guard to also run BEFORE INSERT. On a direct authenticated/
-- anon insert the privileged columns must hold their safe empty values — exactly
-- what handle_new_user (SECURITY DEFINER, exempt) creates: no role, no company,
-- no coach/support privilege. Privileged writers (definer RPCs, service-role)
-- still pass untouched. Uses create-or-replace + trigger recreate so it applies
-- correctly whether or not 0090 has already been applied (never assume it has).

create or replace function guard_profile_privileged_columns()
returns trigger language plpgsql as $$
begin
  -- Privileged / definer / service-role writers pass untouched. Only direct
  -- PostgREST end-user requests arrive as 'authenticated' / 'anon'.
  if current_user not in ('authenticated', 'anon') then
    return NEW;
  end if;

  if TG_OP = 'INSERT' then
    -- A direct end-user insert may only recreate the safe empty shell. role
    -- DEFAULTS to 'CEO', so it must be explicitly null here; is_support_agent is
    -- NOT NULL DEFAULT false, so its safe value is false, not null.
    if NEW.role is not null then
      raise exception 'profiles.role is system-managed; a direct insert may not set it (it defaults to CEO — must be null)';
    end if;
    if NEW.company_id is not null then
      raise exception 'profiles.company_id is system-managed (set via onboarding / invite acceptance), not settable on a direct insert';
    end if;
    if NEW.sales_coach_role is not null then
      raise exception 'profiles.sales_coach_role is admin-managed, not settable on insert';
    end if;
    if NEW.is_support_agent is distinct from false then
      raise exception 'profiles.is_support_agent is admin-managed, not settable on insert';
    end if;
    return NEW;
  end if;

  -- UPDATE: the authz-bearing columns may not CHANGE.
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
  before insert or update on profiles
  for each row execute function guard_profile_privileged_columns();

comment on function guard_profile_privileged_columns() is
  'Freezes role/company_id/sales_coach_role/is_support_agent against direct authenticated/anon PostgREST writes on INSERT and UPDATE (0001 policies do not constrain these columns; role defaults to CEO). Privileged writers — SECURITY DEFINER RPCs and service-role routes — pass through. See 0090, 0091.';
