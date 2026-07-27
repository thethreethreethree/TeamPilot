-- 0197 — Pilot access codes (self-serve pilot onboarding).
--
-- WHY (founder directive, 2026-07-28, client waiting): the current signup flow
-- routes "Request access" → /login → the 6-step onboarding wizard. To streamline
-- pilot onboarding, a new client redeems a single-use 7-char code on the landing
-- page, enters Company + Email + Password, and lands in an account already
-- provisioned for that code's module.
--
-- MODULE SEMANTICS (founder decision — "Provision + land-in-module (soft)"):
-- there is no unified module-gate in this codebase (verified 2026-07-28). The
-- first user of a new company is its admin, who already reaches ELOSTATE + the
-- in-app C.A.R.E console + Sales Coach BY ROLE. The only company-gated product is
-- the C.A.R.E browser EXTENSION (care_tenant_config.plan ∈ {pro,enterprise}).
-- So a module code provisions with EXISTING levers, no new gating structure:
--   · care        → care_tenant_config.plan='pro'  (unlocks the extension)
--   · sales_coach → profiles.sales_coach_role='admin'
--   · elostate    → both of the above (founder: "complete = everything on")
-- The soft model does not hard-restrict navigation (the admin can still reach
-- every surface, as any company admin can today); the module drives provisioning
-- + the post-redeem landing page.
--
-- §3.4 DEVIATION (founder-authorized, on the record): pilot codes SKIP the 30-day
-- AI-guidance control window — redemption sets ai_guidance_enabled=true and
-- ai_guidance_unlock_at=now(). This is a deliberate product decision by the
-- founder ("Skip for pilots — instant guidance") that departs from §3.4's
-- "Month 1 = control (no AI guidance)". Recorded here so the deviation is
-- explicit, not silent (§3.1 on-the-record).
--
-- STRUCTURE (A23/A25/A27):
--   · `code` is UNIQUE and single-use is ENFORCED, not just labelled: the redeem
--     RPC takes a row lock (`for update`) and rejects an already-redeemed code, so
--     there is no double-redeem race — the invariant lives in the write path, not
--     a comment (A27).
--   · The privileged writes (company/profile role+company_id, plan, sales_coach_
--     role) go through a SECURITY DEFINER RPC — the only path exempt from the
--     0090/0091 profile-privileged-column guard, mirroring complete_company_
--     onboarding (0047) and accept_invitation (0008) (A28 precedent).
--   · RLS is enabled with NO authenticated/anon policies: the table is reachable
--     ONLY through the two SECURITY DEFINER functions (and the service role).
--
-- A12 idempotent — safe to re-run.

-- ─── Table ────────────────────────────────────────────────────────────────────
create table if not exists pilot_codes (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique,
  module              text not null check (module in ('elostate', 'care', 'sales_coach')),
  redeemed_at         timestamptz,
  redeemed_by_email   text,
  redeemed_company_id uuid references companies(id) on delete set null,
  created_at          timestamptz not null default now()
);

comment on table pilot_codes is
  'Single-use pilot access codes. Each code grants one module on redemption '
  '(elostate=all, care=extension plan, sales_coach=sales_coach_role). Redemption '
  'is via redeem_pilot_code() only; single-use is row-lock-enforced. RLS-sealed '
  '(no member policies) — reachable only through the SECURITY DEFINER functions.';

-- Fast lookup on the natural key used by both functions (unique already indexes code,
-- but be explicit about the redeemed filter for the status read path).
create index if not exists pilot_codes_code_idx on pilot_codes (code);

alter table pilot_codes enable row level security;
-- Intentionally NO policies for authenticated/anon: this table is written and read
-- ONLY by the SECURITY DEFINER functions below (and the service role). A member
-- must never enumerate or mutate codes directly. (rls-audit: deny-all-by-design.)

-- ─── Validation function (non-consuming, pre-signup) ──────────────────────────
-- Lets the redeem UI check a code + learn its module BEFORE the user creates an
-- account, WITHOUT consuming the code. Returns only {valid, module, redeemed} —
-- no other columns leak. Callable by anon (the client hasn't signed up yet).
-- Enumeration is bounded by the 30^7 keyspace (100 valid) + route rate-limiting.
create or replace function pilot_code_status(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code pilot_codes%rowtype;
begin
  select * into v_code from pilot_codes where code = upper(trim(p_code));
  if not found then
    return jsonb_build_object('valid', false);
  end if;
  return jsonb_build_object(
    'valid', v_code.redeemed_at is null,
    'module', v_code.module,
    'redeemed', v_code.redeemed_at is not null
  );
end;
$$;

revoke all on function pilot_code_status(text) from public;
grant execute on function pilot_code_status(text) to anon, authenticated;

comment on function pilot_code_status(text) is
  'Non-consuming check of a pilot code. Returns {valid, module, redeemed} only. '
  'Callable pre-signup (anon). Does NOT mark the code used.';

-- ─── Redemption RPC (creates the account, single-use enforced) ────────────────
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

  -- Lock the code row, then validate. The lock closes the double-redeem race:
  -- two concurrent redemptions serialize here, and the second sees redeemed_at
  -- set. Single-use is enforced by the WRITE PATH, not a label (A27).
  select * into v_code from pilot_codes
    where code = upper(trim(p_code))
    for update;
  if not found then
    raise exception 'Invalid access code';
  end if;
  if v_code.redeemed_at is not null then
    raise exception 'This access code has already been used';
  end if;

  -- Create the company. The 0045 bootstrap triggers fire in this same
  -- transaction → care_tenant_config + care_agent_state + company_brain rows
  -- exist before the updates below.
  insert into companies (name)
  values (trim(p_company_name))
  returning id into v_company_id;

  -- Attach the caller as admin. SECURITY DEFINER is exempt from the 0090/0091
  -- privileged-column guard, so setting company_id/role here is allowed.
  insert into profiles (id, company_id, full_name, role)
  values (v_user_id, v_company_id, p_full_name, 'admin')
  on conflict (id) do update
    set company_id = excluded.company_id,
        full_name  = coalesce(excluded.full_name, profiles.full_name),
        role       = 'admin';

  -- §3.4 DEVIATION (founder-authorized for pilots): skip the 30-day control
  -- window so the client gets AI guidance immediately. Recorded in the header.
  update companies
    set ai_guidance_enabled    = true,
        ai_guidance_enabled_at = now(),
        ai_guidance_unlock_at  = now()
    where id = v_company_id;

  -- Module provisioning (soft land-in-module) — existing levers only.
  if v_code.module in ('care', 'elostate') then
    update care_tenant_config set plan = 'pro' where company_id = v_company_id;
  end if;
  if v_code.module in ('sales_coach', 'elostate') then
    update profiles set sales_coach_role = 'admin' where id = v_user_id;
  end if;

  -- Consume the code — ties it to the redeeming email + the new company, so the
  -- code is now spent ("the email + code replace the <Pilot Code>", founder).
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

revoke all on function redeem_pilot_code(text, text, text) from public;
grant execute on function redeem_pilot_code(text, text, text) to authenticated;

comment on function redeem_pilot_code(text, text, text) is
  'Redeems a single-use pilot code for the calling (authenticated) user: creates '
  'a company, attaches the caller as admin, provisions the code''s module '
  '(care→plan=pro, sales_coach→sales_coach_role=admin, elostate→both), skips the '
  '§3.4 control window (founder-authorized pilot deviation), and marks the code '
  'used. Row-lock enforced single-use. Raises if the caller already has a company.';
