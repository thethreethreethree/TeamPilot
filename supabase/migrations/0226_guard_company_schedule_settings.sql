-- 0226 — freeze companies.timezone + workweek_start against non-admin direct writes (founder-picked
--        2026-08-20, schedule audit finding). Mirrors 0111 (guard_company_guidance_columns) exactly.
--
-- Why
-- ───
-- The schedule Settings PATCH (/api/schedule/settings) is admin-gated at the ROUTE (ctx.isAdmin). But the
-- companies UPDATE RLS (0095) is `using/with check (id = auth_company_id())` — company-scoped, NOT
-- role-scoped — and `authenticated` holds the UPDATE grant. So a NON-admin company member can bypass the
-- route with a direct PostgREST `UPDATE companies SET timezone = ... WHERE id = <their company>` and change
-- a company-wide schedule setting (everyone's "today" / workweek boundary). Within-tenant (auth_company_id()
-- confines it), LOW-MED, but the route's admin intent is not enforced by the DB. Same route-gated-but-RLS-open
-- class as 0111's §3.4 control window.
--
-- Fix (identical shape to 0111): a BEFORE UPDATE trigger that freezes timezone + workweek_start for
-- authenticated non-admin writers. An UPDATE that doesn't touch them passes (ordinary companies edits). A
-- change requires the caller be CEO/COO/admin — matching isAdminRole (["CEO","COO","admin"]) and the route
-- gate exactly, so the legit admin path (settings PATCH, user-scoped client, route pre-checks isAdmin) still
-- works. Service-role / SECURITY DEFINER contexts bypass (pipelines, seeds, the apply_schedule_import RPC).
-- A separate trigger from companies_guard_guidance (distinct concern); both BEFORE-UPDATE triggers fire.

create or replace function guard_company_schedule_settings()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Service-role / SECURITY DEFINER context (current_user is the table owner) passes untouched.
  if current_user not in ('authenticated', 'anon') then
    return NEW;
  end if;

  -- Neither schedule-settings column changed → an ordinary companies update; allow it.
  if NEW.timezone is not distinct from OLD.timezone
     and NEW.workweek_start is not distinct from OLD.workweek_start then
    return NEW;
  end if;

  -- A change requires company leadership — identical to the settings PATCH route gate (isAdminRole).
  if exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and p.company_id = OLD.id
      and p.role in ('CEO', 'COO', 'admin')
  ) then
    return NEW;
  end if;

  raise exception
    'companies.timezone / workweek_start are manager-set schedule settings — only CEO/COO/admin may change them (see /api/schedule/settings)';
end $$;

drop trigger if exists companies_guard_schedule_settings on companies;
create trigger companies_guard_schedule_settings
  before update on companies
  for each row execute function guard_company_schedule_settings();
