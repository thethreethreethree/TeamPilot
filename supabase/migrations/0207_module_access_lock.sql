-- 0207 — Module hard-lock (founder decision 2026-08-01).
--
-- A pilot code provisions an account for ONE module. Founder's decision: a single-module account is
-- HARD-LOCKED — it may only reach its module's routes and is silently sent to its module home otherwise; a
-- "complete" (elostate) or legacy account has full hub access. 0197 did SOFT landing only ("there is no
-- unified module-gate in this codebase"); this migration adds the gate's reliable signal.
--
-- WHY A COLUMN (not the care_tenant_config lever): the 0045 bootstrap auto-creates a care_tenant_config row
-- for EVERY company, so "has care" cannot distinguish a C.A.R.E account from any other. The redeemed pilot
-- code's module is the truth. We persist it on the company as an RLS-readable column (a company member can
-- already SELECT their own company via 0001) the app guard checks in ONE lookup — no pilot_codes read (which
-- members can't do) and no per-request join.

-- ── 1. The column ──────────────────────────────────────────────────────────
alter table if exists public.companies
  add column if not exists access_module text
    check (access_module is null or access_module in ('care', 'sales_coach'));

comment on column public.companies.access_module is
  'Module hard-lock: care|sales_coach confine the account to that module subtree; null = full hub access '
  '(complete/elostate or legacy). Set from the redeemed pilot code (0207). Enforced by the dashboard layout guard.';

-- ── 2. Backfill existing accounts from the pilot code they redeemed ─────────
-- elostate/complete codes → leave null (full access). Only single-module codes lock.
update public.companies c
  set access_module = pc.module
  from public.pilot_codes pc
  where pc.redeemed_company_id = c.id
    and pc.module in ('care', 'sales_coach')
    and c.access_module is null;

-- ── 3. Set access_module on future redemptions ─────────────────────────────
-- Recreate redeem_pilot_code (0197) VERBATIM + one addition: stamp companies.access_module from the code's
-- module. Everything else is unchanged (same auth gate, same row lock / single-use, same soft-land provisioning).
create or replace function redeem_pilot_code(
  p_code text,
  p_company_name text,
  p_full_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id            uuid := auth.uid();
  v_email              text := auth.jwt() ->> 'email';
  v_code               pilot_codes%rowtype;
  v_company_id         uuid;
  v_existing_company   uuid;
begin
  -- Auth gate — the caller must have signed up (auth.users row) already.
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if coalesce(trim(p_company_name), '') = '' then
    raise exception 'Company name is required';
  end if;

  -- A pilot code creates a NEW company. A user already attached to one must not
  -- redeem (prevents a member re-homing themselves / double provisioning).
  select company_id into v_existing_company from profiles where id = v_user_id;
  if v_existing_company is not null then
    raise exception 'This account already belongs to a company';
  end if;

  -- Lock the code row, then validate. The lock closes the double-redeem race.
  select * into v_code from pilot_codes
    where code = upper(trim(p_code))
    for update;
  if not found then
    raise exception 'Invalid access code';
  end if;
  if v_code.redeemed_at is not null then
    raise exception 'This access code has already been used';
  end if;

  -- Create the company. The 0045 bootstrap triggers fire in this same transaction.
  insert into companies (name)
  values (trim(p_company_name))
  returning id into v_company_id;

  -- Attach the caller as admin (DEFINER is exempt from the 0090/0091 privileged-column guard).
  insert into profiles (id, company_id, full_name, role)
  values (v_user_id, v_company_id, p_full_name, 'admin')
  on conflict (id) do update
    set company_id = excluded.company_id,
        full_name  = coalesce(excluded.full_name, profiles.full_name),
        role       = 'admin';

  -- §3.4 DEVIATION (founder-authorized for pilots): skip the 30-day control window.
  update companies
    set ai_guidance_enabled    = true,
        ai_guidance_enabled_at = now(),
        ai_guidance_unlock_at  = now()
    where id = v_company_id;

  -- Module provisioning (soft land-in-module) — existing levers.
  if v_code.module in ('care', 'elostate') then
    update care_tenant_config set plan = 'pro' where company_id = v_company_id;
  end if;
  if v_code.module in ('sales_coach', 'elostate') then
    update profiles set sales_coach_role = 'admin' where id = v_user_id;
  end if;

  -- Module HARD-LOCK (founder 2026-08-01, 0207): stamp the lock. A single-module code confines the account;
  -- 'elostate' (complete) leaves access_module null = full hub access.
  update companies
    set access_module = case v_code.module
                          when 'care' then 'care'
                          when 'sales_coach' then 'sales_coach'
                          else null
                        end
    where id = v_company_id;

  -- Consume the code — ties it to the redeeming email + the new company.
  update pilot_codes
    set redeemed_at         = now(),
        redeemed_by_email   = v_email,
        redeemed_company_id  = v_company_id
    where id = v_code.id;

  return jsonb_build_object(
    'company_id', v_company_id,
    'module', v_code.module
  );
end;
$$;
