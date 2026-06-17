-- 0047 — Extend complete_company_onboarding RPC to accept the
-- tenant's AI product context atomically.
--
-- Background: 0046 created an atomic onboarding RPC that
-- inserts the company + upserts the profile in one transaction.
-- The trigger pair from 0045 creates care_tenant_config and
-- care_agent_state inside the same transaction. Result: every
-- new tenant has the full per-tenant data scaffolding on the
-- day they sign up.
--
-- Gap closed by this migration:
-- care_tenant_config.ai_product_context starts NULL. Without
-- it, Jeff (the customer-facing AI) falls back to the generic
-- "let me bring in a teammate" path for every customer
-- question — safe per the AMD-006 prompt discipline, but means
-- C.A.R.E isn't truly useful until the tenant manually
-- configures product context in Settings.
--
-- Per AMD-006 §1.5.1 layer 2 (operational feature effectivity):
-- a feature whose customer-facing surface defaults to
-- "hand off to a human" until manual configuration isn't
-- end-to-end useful. The onboarding wizard is the right place
-- to capture product context — the founder is already
-- thinking about their business; ask while the cursor is hot.
--
-- This migration extends the RPC to accept an OPTIONAL
-- p_ai_product_context parameter. If provided (and non-empty),
-- the same transaction that creates the tenant also updates
-- care_tenant_config.ai_product_context. The wizard can pass
-- the context if the user filled the new step, or NULL if they
-- left it blank.
--
-- Signature change (added p_ai_product_context) requires
-- DROPPING the old function first — Postgres treats
-- CREATE OR REPLACE with a different parameter list as a NEW
-- function rather than a replacement.
--
-- A12 idempotent.

-- Drop the previous version (signature includes the param list).
-- This is safe — no code outside the wizard calls this RPC, and
-- the wizard code in the same commit-pair is updated to pass
-- the new signature.
drop function if exists complete_company_onboarding(
  text, text, text, text, jsonb, text
);

create or replace function complete_company_onboarding(
  p_company_name text,
  p_industry text,
  p_size text,
  p_stage text,
  p_goals jsonb,
  p_user_full_name text,
  p_ai_product_context text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_existing_company_id uuid;
begin
  -- Auth gate.
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Required-input validation.
  if coalesce(trim(p_company_name), '') = '' then
    raise exception 'Company name is required';
  end if;
  if coalesce(trim(p_user_full_name), '') = '' then
    raise exception 'Your name is required';
  end if;

  -- Idempotency — already-onboarded user short-circuits.
  select company_id into v_existing_company_id
  from profiles
  where id = v_user_id;
  if v_existing_company_id is not null then
    return v_existing_company_id;
  end if;

  -- Atomic block.
  insert into companies (name, industry, size, stage, goals)
  values (p_company_name, p_industry, p_size, p_stage, p_goals)
  returning id into v_company_id;

  insert into profiles (id, company_id, full_name, role)
  values (v_user_id, v_company_id, p_user_full_name, 'admin')
  on conflict (id) do update
    set company_id = v_company_id,
        full_name = excluded.full_name,
        role = 'admin';

  -- If the user supplied product context in the wizard, write
  -- it through to the care_tenant_config row that trigger 0045
  -- created on companies INSERT. This stays inside the
  -- onboarding transaction — either the tenant has product
  -- context from t=0 or they don't, no partial state.
  if coalesce(trim(p_ai_product_context), '') <> '' then
    update care_tenant_config
      set ai_product_context = p_ai_product_context
    where company_id = v_company_id;
  end if;

  return v_company_id;
end;
$$;

revoke all on function complete_company_onboarding(
  text, text, text, text, jsonb, text, text
) from public;
grant execute on function complete_company_onboarding(
  text, text, text, text, jsonb, text, text
) to authenticated;

comment on function complete_company_onboarding(
  text, text, text, text, jsonb, text, text
) is
  'Atomically completes new-tenant onboarding: inserts a company '
  'row, links the calling user as admin, fires per-tenant '
  'bootstrap triggers (company_brain, care_tenant_config, '
  'care_agent_state). When p_ai_product_context is non-empty, '
  'updates care_tenant_config.ai_product_context inside the same '
  'transaction. Idempotent if the user already has a company_id.';
