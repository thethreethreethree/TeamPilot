-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0291 — the admin-role list, finished: the copies 0265 did not reach call admin_roles() (founder ruling 2026-09-22)
-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0265 replaced the 47 POLICY copies of ('CEO','COO','admin') with admin_roles() (which includes CFO, as
-- src/lib/roles.ts ADMIN_ROLES does). FUNCTIONS kept their copies; 0290 fixed is_sales_coach_manager. INVARIANT 39
-- (added with 0290) found the rest, below. Each is recreated from its LATEST definition, copied verbatim, with ONLY the
-- role literal replaced — the 0265 discipline: every tenant/company check stays byte-for-byte as it was.
--
-- What changes, by the founder's ruling (C-Suite = admin): a person whose company role is CFO is treated as an admin
-- by these checks, as the app already treats them (isAdminRole). Notably:
--   · fin_effective_role — a company's CFO now gets the finance 'cfo' role by default like CEO/COO/admin; before, the
--     company's actual CFO had NO finance role unless someone added one in fin_roles.
--   · is_vendor_super_admin — still only the vendor company (the company-id predicate is unchanged); its CFO now
--     matches the route layer (requireVendorAdmin, ctx.isAdmin), which already admitted them.
--   · team_invitations insert — "inviting a C-Suite role needs an admin": ('CEO','CFO','COO') becomes admin_roles()
--     ('admin' is not an invitable role, 0239 check), the same set, now from the one list.
-- Idempotent (A12): create or replace / drop policy if exists.
-- ═════════════════════════════════════════════════════════════════════════════════════════════

-- ── close_topic (latest: 0012_chat_event_emission.sql) — 1 literal(s) → admin_roles() ──
create or replace function close_topic(
  p_topic_id   uuid,
  p_summary    text
)
returns void
language plpgsql
security invoker
as $$
declare
  v_topic   chat_topics;
  v_user_id uuid := auth.uid();
  v_is_admin boolean;
  v_event_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_topic from chat_topics where id = p_topic_id;
  if v_topic.id is null then
    raise exception 'Topic not found';
  end if;

  select exists (
    select 1 from chat_participants
    where topic_id = p_topic_id
      and user_id = v_user_id
      and role = 'admin'
  ) or exists (
    select 1 from profiles
    where id = v_user_id
      and company_id = v_topic.company_id
      and role = any (admin_roles())
  ) into v_is_admin;

  if not v_is_admin then
    raise exception 'Only topic admins or company CEO/COO can close a topic';
  end if;

  if v_topic.status = 'closed' then
    raise exception 'Topic already closed';
  end if;

  insert into chat_messages (topic_id, company_id, author_id, kind, body)
  values (p_topic_id, v_topic.company_id, v_user_id, 'system',
          'Topic closed: ' || coalesce(p_summary, '(no summary)'));

  update chat_topics
     set status = 'closed',
         closed_at = now(),
         closed_by = v_user_id,
         close_summary = p_summary
   where id = p_topic_id;

  -- ALWAYS emit chat.topic_closed (new in 0012). signal_sources rows
  -- with predicate {close_durability: 'held'|'reopened'|...} route
  -- this single event kind to outcome-specific signal kinds. At close
  -- time durability is usually NULL — the durability-update event is
  -- a separate emit by a future review flow.
  insert into events (company_id, kind, subject, actor, payload)
  values (
    v_topic.company_id,
    'chat.topic_closed',
    'chat_topic:' || p_topic_id::text,
    v_user_id,
    jsonb_build_object(
      'topic_id', p_topic_id,
      'close_summary', p_summary,
      'close_durability', v_topic.close_durability,
      'linked_problem_id', v_topic.problem_id
    )
  )
  returning id into v_event_id;
  perform derive_signals_for_event(v_event_id);

  if v_topic.problem_id is not null then
    update problems
       set status = 'resolved',
           resolved_at = now()
     where id = v_topic.problem_id;
    perform record_event(
      'problem.resolved',
      'problem:' || v_topic.problem_id::text,
      jsonb_build_object(
        'problem_id', v_topic.problem_id,
        'closed_via_chat_topic', p_topic_id,
        'close_summary', p_summary
      )
    );
  end if;
end;
$$;

-- ── is_topic_admin (latest: 0033_chat_rls_hardening.sql) — 1 literal(s) → admin_roles() ──
create or replace function is_topic_admin(p_topic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from chat_participants
      where topic_id = p_topic_id
        and user_id = auth.uid()
        and role = 'admin'
        and left_at is null
    )
    or exists (
      select 1
      from chat_topics t
      join profiles p on p.company_id = t.company_id
      where t.id = p_topic_id
        and p.id = auth.uid()
        and p.role = any (admin_roles())
    );
$$;

-- ── emit_care_agent_state_for_new_agent (latest: 0045_tenant_bootstrap_triggers.sql) — 1 literal(s) → admin_roles() ──
create or replace function emit_care_agent_state_for_new_agent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only act when the profile is a C.A.R.E participant:
  --   - support_agent flag is true, OR
  --   - role is one that has agent-equivalent access (CEO, COO,
  --     admin per the agent route gate in /api/care/agent/*)
  -- AND the profile has a company_id (not the placeholder state).
  if new.company_id is not null
     and (
       coalesce(new.is_support_agent, false)
       or new.role = any (admin_roles())
     )
  then
    -- INSERT-or-ignore so re-triggering on subsequent profile
    -- updates doesn't churn the row.
    insert into care_agent_state (agent_id, company_id)
    values (new.id, new.company_id)
    on conflict (agent_id) do nothing;
  end if;
  return new;
end;
$$;

-- ── is_vendor_super_admin (latest: 0089_harden_vendor_super_admin_company_scope.sql) — 1 literal(s) → admin_roles() ──
create or replace function is_vendor_super_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from profiles p
    where p.id = auth.uid()
      and p.role = any (admin_roles())
      -- The missing predicate: the caller's company must BE the vendor company.
      and p.company_id = 'c3e7f389-3df6-48c8-876b-0cd4baf5c2a7'::uuid
  );
$$;

-- ── guard_care_agent_state_admin_cols (latest: 0107_tenant_pushout_residuals.sql) — 1 literal(s) → admin_roles() ──
create or replace function guard_care_agent_state_admin_cols()
returns trigger language plpgsql as $$
begin
  -- Service-role / definer context passes untouched (pipelines, admin routes).
  if current_user not in ('authenticated', 'anon') then
    return NEW;
  end if;
  -- Added by 0107: company_id is the agent's tenant key — immutable for ANY authenticated
  -- caller (agent OR admin). Checked BEFORE the admin bypass so an admin can't relocate it
  -- cross-tenant either. (The tenant-key push-out class; 0095 froze only the capacity columns.)
  if NEW.company_id is distinct from OLD.company_id then
    raise exception 'care_agent_state.company_id is immutable';
  end if;
  -- A company admin may change the admin-controlled columns.
  if exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and p.company_id = OLD.company_id
      and p.role = any (admin_roles())
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

-- ── guard_company_guidance_columns (latest: 0111_guard_company_guidance_columns.sql) — 1 literal(s) → admin_roles() ──
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
      and p.role = any (admin_roles())
  ) then
    return NEW;
  end if;

  raise exception
    'companies.ai_guidance_* is the §3.4 control window — only CEO/COO/admin may change it (see /api/brain/unlock)';
end $$;

-- ── fin_effective_role (latest: 0116_fin_foundation_settings_roles_coa.sql) — 1 literal(s) → admin_roles() ──
create or replace function fin_effective_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select fr.role from fin_roles fr
      where fr.company_id = auth_company_id() and fr.user_id = auth.uid()),
    (select case when p.role = any (admin_roles()) then 'cfo' else null end
       from profiles p where p.id = auth.uid())
  );
$$;

-- ── guard_company_schedule_settings (latest: 0226_guard_company_schedule_settings.sql) — 1 literal(s) → admin_roles() ──
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
      and p.role = any (admin_roles())
  ) then
    return NEW;
  end if;

  raise exception
    'companies.timezone / workweek_start are manager-set schedule settings — only CEO/COO/admin may change them (see /api/schedule/settings)';
end $$;

-- ── auth_is_schedule_manager (latest: 0228_guard_schedule_manager_tenant_param.sql) — 1 literal(s) → admin_roles() ──
create or replace function auth_is_schedule_manager(p_company uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_company = auth_company_id() and exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and p.company_id = p_company
      and p.role = any (admin_roles())
  );
$$;

-- ── policy "team_invitations - insert" (latest: 0239_team_invite_tier_roles.sql) ──
drop policy if exists "team_invitations - insert" on team_invitations;
create policy "team_invitations - insert" on team_invitations
  for insert with check (
    company_id = auth_company_id()
    and (
      -- non-admin roles: any company member may invite (mirrors ADMIN_ROLES minus the invitable-admin subset)
      not (role = any (admin_roles()))
      -- admin roles (CEO/CFO/COO): only an existing admin may assign
      -- (admin_roles(), 0265/0291: the one list, in lockstep with roles.ts ADMIN_ROLES)
      or exists (
        select 1 from profiles p
        where p.id = auth.uid() and p.role = any (admin_roles())
      )
    )
  );
