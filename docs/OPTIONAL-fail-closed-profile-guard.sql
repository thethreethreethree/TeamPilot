-- OPTIONAL — fail-closed variant of the profiles privileged-column guard
--
-- ⚠️ This is NOT a migration and is deliberately NOT in supabase/migrations/ (so a
-- "db push / apply all" does NOT run it). Paste + run it MANUALLY in the Supabase
-- SQL editor ONLY if you decide you want the guard to fail closed. The applied
-- 0090/0091 guard (block-list) is correct for standard Supabase and the runbook
-- validates it — this is a defense-in-depth posture choice, not a required fix.
--
-- WHY consider it. 0090/0091 exempt the privileged context with a BLOCK-LIST
-- (`current_user not in ('authenticated','anon') -> allow`). That never breaks
-- onboarding, but fails OPEN: if a deployment ran authenticated requests under a
-- role name other than 'authenticated'/'anon', the guard would not block that
-- caller, silently re-opening the CRITICAL. This variant fails CLOSED: it exempts
-- ONLY the known privileged writers and freezes the columns for every other role.
-- If THIS allow-list is wrong for your project (a SECURITY DEFINER RPC runs under
-- an owner not listed), the failure is LOUD — onboarding errors with
-- "profiles.role is system-managed" — not a silent hole.
--
-- AFTER running: re-run the runbook §3 (new-company onboarding, create a team-chat
-- topic, toggle a support agent). All three must still succeed. If onboarding
-- errors, the RPC owner in your project isn't in the list below — tell me the exact
-- role from the error and I extend it. To revert, re-run migration 0091's function
-- definition (the block-list).

create or replace function guard_profile_privileged_columns()
returns trigger language plpgsql
set search_path = public
as $$
begin
  -- FAIL-CLOSED allow-list: exempt ONLY known privileged writers.
  if current_user in (
    'postgres', 'service_role', 'supabase_admin', 'supabase_auth_admin'
  ) then
    return NEW;
  end if;

  if TG_OP = 'INSERT' then
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
