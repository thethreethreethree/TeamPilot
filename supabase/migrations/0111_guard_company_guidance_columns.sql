-- 0111 — freeze the §3.4 control-window columns (companies.ai_guidance_*) against
--        non-leadership direct writes. Closes a §3.4-integrity + authz gap.
--
-- Why
-- ───
-- The §3.4 month-1 control window ("Month 1 = control, no AI guidance" — the honesty-
-- is-the-moat baseline that makes Month-2 improvement attributable to the method) is stored
-- on companies: ai_guidance_enabled (manual unlock), ai_guidance_unlock_at (auto-unlock
-- time), ai_guidance_enabled_at. loadControlGate() reads them; a member with guidance
-- flipped on during month-1 defeats the single-variable experiment.
--
-- The INTENDED unlock (/api/brain/unlock) is explicitly admin-gated: "Only company
-- leadership (CEO/COO/admin) can unlock the §3.4 control window — an explicit constitutional
-- override." But the RLS `company - update` policy (0095) is `using/with check
-- (id = auth_company_id())` — company-scoped, NOT role-scoped. So ANY authenticated member
-- can bypass that admin gate with a direct PostgREST
-- `UPDATE companies SET ai_guidance_enabled = true WHERE id = <their company>` — turning
-- guidance on in the control month themselves, corrupting the §3.4 baseline. This is the
-- same route-gated-but-RLS-open class as the 0089/0090 authz findings, here on the
-- product's CORE honesty control. (settings PATCH is safe — ai_guidance_* is not in its
-- ALLOWED_FIELDS whitelist; the hole is direct-RLS only.)
--
-- Fix (mirror guard_profile_privileged_columns / care_agent_state guard): a BEFORE UPDATE
-- trigger that freezes the three ai_guidance_* columns for authenticated non-admin writers.
-- An UPDATE that doesn't touch them passes (normal settings edits). A change requires the
-- caller be CEO/COO/admin — matching the route gate exactly, so the legit admin unlock
-- (unlockControlGate via /api/brain/unlock, user-scoped client, route pre-checks isAdmin)
-- still works. Service-role / SECURITY DEFINER contexts bypass (pipelines, seeds). §A12
-- idempotent. STATUS: UNAPPLIED — founder applies alongside the 0101-0110 authz queue.

create or replace function guard_company_guidance_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Service-role / SECURITY DEFINER context (current_user is the table owner, not an
  -- end-user role) passes untouched — pipelines, seeds, definer RPCs.
  if current_user not in ('authenticated', 'anon') then
    return NEW;
  end if;

  -- If none of the §3.4 control-window columns changed, this is an ordinary company
  -- settings update — allow it.
  if NEW.ai_guidance_enabled is not distinct from OLD.ai_guidance_enabled
     and NEW.ai_guidance_unlock_at is not distinct from OLD.ai_guidance_unlock_at
     and NEW.ai_guidance_enabled_at is not distinct from OLD.ai_guidance_enabled_at then
    return NEW;
  end if;

  -- A change to the control window requires leadership — identical to the
  -- /api/brain/unlock route gate. The window is a constitutional honesty control (§3.4),
  -- not a member-settable preference.
  if exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and p.company_id = OLD.id
      and p.role in ('CEO', 'COO', 'admin')
  ) then
    return NEW;
  end if;

  raise exception
    'companies.ai_guidance_* is the §3.4 control window — only CEO/COO/admin may change it (see /api/brain/unlock)';
end $$;

drop trigger if exists companies_guard_guidance on companies;
create trigger companies_guard_guidance
  before update on companies
  for each row execute function guard_company_guidance_columns();
