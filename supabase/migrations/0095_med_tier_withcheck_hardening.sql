-- 0095 — MED-tier UPDATE hardening: mirror WITH CHECK + care_agent_state column freeze
--
-- Founder directive (2026-07-07): after the profiles CRITICAL (0090/0091) and the
-- class sweeps, harden the MED-tier UPDATE policies so the DB — not the API —
-- enforces column-level / tenant authz. The recurring pattern the sweeps named:
-- "column-level discipline enforced at the API layer, not the DB" (stated verbatim
-- in 0018 / 0034 / 0042). A direct PostgREST call bypasses the API, so each of
-- these UPDATE policies has `USING` (gating which OLD row) but no `WITH CHECK`
-- (gating the NEW row) — letting an authenticated member push a row's tenant key
-- (company_id / task_id / agent_id) to a foreign value. None is cross-tenant READ
-- today (hence MED), but the missing WITH CHECK is a genuine integrity gap.
--
-- FIX PATTERN. Recreate each UPDATE policy with a WITH CHECK that MIRRORS its
-- USING. Any same-tenant update (the OLD row already satisfied USING, and the
-- tenant key is unchanged) passes untouched; only an update that changes the
-- tenant key to a foreign value — the exact push-out vandalism — is blocked.
-- Service-role writes bypass RLS entirely, so pipelines are unaffected.
--
-- Deliberately NOT changed (§A15 — a flag can close as intentional): the
-- "admin-only in the app" gates on feedback triage / smoke_test_versions authoring
-- are intentionally kept OUT of the policy (0018 comment: "the role taxonomy is
-- still settling"). Forcing a role predicate now would contradict that documented
-- decision. Those stay app-gated; only the tenant WITH CHECK is added.

-- ── companies ──────────────────────────────────────────────────
drop policy if exists "company - update" on companies;
create policy "company - update" on companies
  for update using (id = auth_company_id())
  with check (id = auth_company_id());

-- ── feedback ───────────────────────────────────────────────────
drop policy if exists "feedback - update" on feedback;
create policy "feedback - update" on feedback
  for update using (company_id = auth_company_id())
  with check (company_id = auth_company_id());

-- ── smoke_test_versions ────────────────────────────────────────
drop policy if exists "smoke_test_versions - update" on smoke_test_versions;
create policy "smoke_test_versions - update" on smoke_test_versions
  for update using (company_id = auth_company_id())
  with check (company_id = auth_company_id());

-- ── chat_pins ──────────────────────────────────────────────────
drop policy if exists "chat_pins - update" on chat_pins;
create policy "chat_pins - update" on chat_pins
  for update using (
    company_id = auth_company_id()
    and exists (
      select 1 from chat_participants p
      where p.topic_id = chat_pins.topic_id
        and p.user_id = auth.uid()
        and p.left_at is null
    )
  )
  with check (
    company_id = auth_company_id()
    and exists (
      select 1 from chat_participants p
      where p.topic_id = chat_pins.topic_id
        and p.user_id = auth.uid()
        and p.left_at is null
    )
  );

-- ── task_participants ──────────────────────────────────────────
drop policy if exists "task_participants - update" on task_participants;
create policy "task_participants - update" on task_participants
  for update using (
    exists (
      select 1 from tasks t
      where t.id = task_participants.task_id
        and t.company_id = auth_company_id()
    )
  )
  with check (
    exists (
      select 1 from tasks t
      where t.id = task_participants.task_id
        and t.company_id = auth_company_id()
    )
  );

-- ── support_customers ──────────────────────────────────────────
drop policy if exists "support_customers - update" on support_customers;
create policy "support_customers - update" on support_customers
  for update using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.company_id = support_customers.company_id
    )
  )
  with check (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.company_id = support_customers.company_id
    )
  );

-- ── support_conversations ──────────────────────────────────────
drop policy if exists "support_conversations - update" on support_conversations;
create policy "support_conversations - update" on support_conversations
  for update using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.company_id = support_conversations.company_id
        and (p.is_support_agent or p.role in ('CEO', 'COO', 'admin'))
    )
  )
  with check (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.company_id = support_conversations.company_id
        and (p.is_support_agent or p.role in ('CEO', 'COO', 'admin'))
    )
  );

-- ── support_durability_checks ──────────────────────────────────
drop policy if exists "support_durability_checks - update" on support_durability_checks;
create policy "support_durability_checks - update" on support_durability_checks
  for update using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.company_id = support_durability_checks.company_id
        and (p.is_support_agent or p.role in ('CEO', 'COO', 'admin'))
    )
  )
  with check (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.company_id = support_durability_checks.company_id
        and (p.is_support_agent or p.role in ('CEO', 'COO', 'admin'))
    )
  );

-- ── coaching_sessions ──────────────────────────────────────────
drop policy if exists "coaching_sessions - update" on coaching_sessions;
create policy "coaching_sessions - update" on coaching_sessions
  for update using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.company_id = coaching_sessions.company_id
        and (coaching_sessions.agent_id = p.id or p.role in ('CEO', 'COO', 'admin'))
    )
  )
  with check (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.company_id = coaching_sessions.company_id
        and (coaching_sessions.agent_id = p.id or p.role in ('CEO', 'COO', 'admin'))
    )
  );

-- ── care_agent_state — both UPDATE policies get a mirrored WITH CHECK ──
drop policy if exists "care_agent_state - self update" on care_agent_state;
create policy "care_agent_state - self update" on care_agent_state
  for update using (agent_id = auth.uid())
  with check (agent_id = auth.uid());

drop policy if exists "care_agent_state - admin update" on care_agent_state;
create policy "care_agent_state - admin update" on care_agent_state
  for update using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.company_id = care_agent_state.company_id
        and p.role in ('CEO', 'COO', 'admin')
    )
  )
  with check (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.company_id = care_agent_state.company_id
        and p.role in ('CEO', 'COO', 'admin')
    )
  );

-- ── care_agent_state column freeze (the "freeze trigger" half of the ask) ──
-- max_concurrent + channels are ADMIN-controlled (0042 create-table comments);
-- status + last_seen_at are agent-controlled. RLS is row-level, so the self-update
-- policy above still lets an agent touch their own row — moving the admin-column
-- discipline out of the API and into the DB requires a column-level trigger.
create or replace function guard_care_agent_state_admin_cols()
returns trigger language plpgsql as $$
begin
  -- Service-role / definer context passes untouched (pipelines, admin routes).
  if current_user not in ('authenticated', 'anon') then
    return NEW;
  end if;
  -- A company admin may change the admin-controlled columns.
  if exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and p.company_id = OLD.company_id
      and p.role in ('CEO', 'COO', 'admin')
  ) then
    return NEW;
  end if;
  -- Otherwise (an agent self-updating) the capacity columns are frozen; status /
  -- last_seen_at remain freely settable.
  if NEW.max_concurrent is distinct from OLD.max_concurrent then
    raise exception 'care_agent_state.max_concurrent is admin-managed, not agent-settable';
  end if;
  if NEW.channels is distinct from OLD.channels then
    raise exception 'care_agent_state.channels is admin-managed, not agent-settable';
  end if;
  return NEW;
end $$;

drop trigger if exists care_agent_state_guard_admin_cols on care_agent_state;
create trigger care_agent_state_guard_admin_cols
  before update on care_agent_state
  for each row execute function guard_care_agent_state_admin_cols();
