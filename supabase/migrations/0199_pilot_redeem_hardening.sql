-- 0199 — Pilot redemption hardening (audit findings F0, F1, F4 from the 2026-07-28 build audit).
--
-- F0 (MEDIUM, §1.5/A25 — concurrency race): the already-has-company guard in 0197 read the
--   caller's profile WITHOUT a row lock. Two concurrent redeem calls for the same brand-new user
--   (different codes) both saw company_id=null, both created a company, both consumed a code —
--   wasting a scarce code and orphaning a company. Fix: `for update` on the profile read so
--   concurrent same-user redemptions serialize; the 2nd then sees the company and raises.
--
-- F1 (LOW, A27/L1): 0197 created a redundant plain index on `code` — the UNIQUE constraint already
--   indexes it, and the plain index helps nothing the unique index doesn't. Drop it.
--
-- F4 (LOW, AMD-006 L2 — silent 0-row write): the care/elostate plan grant did
--   `update care_tenant_config set plan='pro'` and never checked it hit a row. If the 0045
--   bootstrap trigger hadn't created that row, the extension would silently not unlock while the
--   RPC returned success. Fix: raise if the update affected 0 rows (fail honest, not silent).
--
-- Only redeem_pilot_code changes (create-or-replace preserves the 0197+0198 grant posture; we
-- re-assert it explicitly so the intended authenticated-only grant is self-documented + idempotent).
-- A12 idempotent.

-- ── F1: drop the redundant index ──
drop index if exists pilot_codes_code_idx;

-- ── F0 + F4: re-create the redemption RPC with the profile row lock + the plan-row check ──
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
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if coalesce(trim(p_company_name), '') = '' then
    raise exception 'Company name is required';
  end if;

  -- F0: LOCK the caller's profile row before reading its company_id. This serializes
  -- concurrent same-user redemptions: the second waits here, then sees the company_id the
  -- first set and raises below — so a user can never consume two codes / create two companies
  -- via a race. The row exists (handle_new_user, 0011, creates it on signup).
  select company_id into v_existing_company
    from profiles where id = v_user_id
    for update;
  if v_existing_company is not null then
    raise exception 'This account already belongs to a company';
  end if;

  -- Lock the code row, validate single-use (unchanged from 0197 — A25/A27).
  select * into v_code from pilot_codes
    where code = upper(trim(p_code))
    for update;
  if not found then
    raise exception 'Invalid access code';
  end if;
  if v_code.redeemed_at is not null then
    raise exception 'This access code has already been used';
  end if;

  -- Create the company (0045 triggers fire in-txn → care_tenant_config etc. exist below).
  insert into companies (name)
  values (trim(p_company_name))
  returning id into v_company_id;

  -- Attach caller as admin (DEFINER exempt from the 0090/0091 privileged-column guard).
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

  -- Module provisioning (soft land-in-module).
  if v_code.module in ('care', 'elostate') then
    update care_tenant_config set plan = 'pro' where company_id = v_company_id;
    -- F4: fail honest instead of silently not-unlocking if the bootstrap row is missing.
    if not found then
      raise exception 'Provisioning failed: care_tenant_config missing for the new company';
    end if;
  end if;
  if v_code.module in ('sales_coach', 'elostate') then
    update profiles set sales_coach_role = 'admin' where id = v_user_id;
  end if;

  -- Consume the code.
  update pilot_codes
    set redeemed_at         = now(),
        redeemed_by_email   = v_email,
        redeemed_company_id  = v_company_id
    where id = v_code.id;

  return jsonb_build_object('company_id', v_company_id, 'module', v_code.module);
end;
$$;

-- Re-assert the intended grant posture (authenticated-only; anon revoked per 0198). Idempotent.
revoke all on function redeem_pilot_code(text, text, text) from public;
revoke execute on function redeem_pilot_code(text, text, text) from anon;
grant execute on function redeem_pilot_code(text, text, text) to authenticated;
