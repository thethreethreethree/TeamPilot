-- 0046 — Atomic onboarding completion RPC.
--
-- Background: the onboarding wizard's finish() handler runs
-- TWO separate writes against Supabase:
--
--   1. INSERT companies (...)
--   2. UPSERT profiles (id, company_id, full_name, role)
--
-- If step 1 succeeds and step 2 fails (network blip, browser
-- close, RLS rejection), the user has just created a company
-- they CANNOT access — orphan tenant. They'd hit /onboarding
-- again on retry, see the form fields cleared, fill them in
-- again, INSERT a SECOND company, and now the first one is
-- permanently abandoned.
--
-- Per AMD-006 §1.5.1 layer 3 (synergetic composition): a
-- two-step write that isn't atomic doesn't compose with the
-- "user might lose connection" failure mode. The fix is an RPC
-- that wraps both writes in a single transaction. If anything
-- fails, the whole transaction rolls back — the user sees the
-- error, hits retry, and there's no half-created tenant left
-- behind.
--
-- The function also lets us add server-side validation in one
-- place (e.g., require non-empty company_name) without
-- duplicating the check in every onboarding code path.
--
-- A12 idempotent.

create or replace function complete_company_onboarding(
  p_company_name text,
  p_industry text,
  p_size text,
  p_stage text,
  p_goals jsonb,
  p_user_full_name text
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
  -- Auth gate — the RPC can only complete onboarding for the
  -- currently authenticated user. There is no path for an admin
  -- to call this on someone else's behalf; the wizard runs in
  -- the user's own browser context.
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Validate inputs. Server-side checks back up the client-side
  -- canProceed() gate in the wizard.
  if coalesce(trim(p_company_name), '') = '' then
    raise exception 'Company name is required';
  end if;
  if coalesce(trim(p_user_full_name), '') = '' then
    raise exception 'Your name is required';
  end if;

  -- Idempotency — if the user already completed onboarding (has
  -- company_id), short-circuit and return that id rather than
  -- creating a second company. Handles the "user double-clicks
  -- Launch" + "user retries after a confused success" cases.
  select company_id into v_existing_company_id
  from profiles
  where id = v_user_id;
  if v_existing_company_id is not null then
    return v_existing_company_id;
  end if;

  -- Atomic block — INSERT company + UPSERT profile in a single
  -- transaction. Either both succeed or neither does. The
  -- trigger pair from 0045 fires inside this transaction:
  --   - companies INSERT → care_tenant_config row
  --   - profiles UPSERT with role='admin' → care_agent_state row
  --   - companies INSERT also fires the 0007 company_brain trigger
  -- If ANY of these fail, the whole block rolls back.
  insert into companies (name, industry, size, stage, goals)
  values (p_company_name, p_industry, p_size, p_stage, p_goals)
  returning id into v_company_id;

  insert into profiles (id, company_id, full_name, role)
  values (v_user_id, v_company_id, p_user_full_name, 'admin')
  on conflict (id) do update
    set company_id = v_company_id,
        full_name = excluded.full_name,
        role = 'admin';

  return v_company_id;
end;
$$;

-- Auth-only access. The RPC reads auth.uid() so anonymous calls
-- would raise inside the function — but defense in depth, only
-- expose to authenticated users.
revoke all on function complete_company_onboarding(
  text, text, text, text, jsonb, text
) from public;
grant execute on function complete_company_onboarding(
  text, text, text, text, jsonb, text
) to authenticated;

comment on function complete_company_onboarding(
  text, text, text, text, jsonb, text
) is
  'Atomically completes new-tenant onboarding: inserts a company '
  'row, links the calling user as admin, fires per-tenant '
  'bootstrap triggers (company_brain, care_tenant_config, '
  'care_agent_state) inside the same transaction. Idempotent '
  'if the user already has a company_id — returns it instead of '
  'creating a second.';
