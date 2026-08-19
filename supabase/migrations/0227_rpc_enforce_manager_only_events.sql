-- 0227 — enforce RQ6 (manager-only events) INSIDE the schedule write RPCs (founder-picked 2026-08-20).
--
-- Finding (live probe): the RQ6 manager-only-event gate lived only in the TS events route
-- (MANAGER_ONLY_EVENT_TYPES). Both schedule write RPCs are `security invoker`, EXECUTE-granted to
-- `authenticated`, and checked the caller's COMPANY (auth_company_id()) but NOT their ROLE. So via a direct
-- PostgREST RPC a non-admin member could:
--   • append_schedule_event('TIMEOFF_APPROVED', ...)  → self-approve time-off (and any manager-only event);
--   • apply_schedule_import(...)                       → define/assign/cancel shifts in bulk.
-- Both confirmed live (a real non-admin Member succeeded). Within-tenant (company is session-derived; tenant
-- isolation holds), but it defeats the manager-control model. Same class as 0226/0111 (route-gated but the
-- write PRIMITIVE is open), here on the CORE write path.
--
-- Fix (founder pick — enforce in the RPC): a shared admin predicate + a role gate in each RPC. Manager-only
-- event types require CEO/COO/admin; employee types (TIMEOFF_REQUESTED / AVAILABILITY_SET / SWAP_REQUESTED)
-- stay open for Phase-6 self-service. apply_schedule_import always requires a manager (it only ever creates
-- manager-only events). Service-role / SECURITY DEFINER contexts (current_user = table owner) bypass —
-- pipelines, seeds. The TS route keeps its check as an early-400 defense; this is the real gate.
--
-- Single-overload preserved: each `create or replace` keeps the EXACT existing signature (append: (text,
-- jsonb); apply: (text[], jsonb, jsonb, uuid[])), so no new overload is created (verify:live single-overload
-- invariant stays green).

-- Shared predicate: is the current end-user a manager (CEO/COO/admin) of p_company? SECURITY DEFINER so it
-- reads profiles like auth_company_id() does; auth.uid() still reflects the original JWT caller.
create or replace function auth_is_schedule_manager(p_company uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and p.company_id = p_company
      and p.role in ('CEO', 'COO', 'admin')
  );
$$;

create or replace function append_schedule_event(
  p_type    text,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_company_id uuid;
  v_id         uuid;
begin
  v_company_id := auth_company_id();
  if v_company_id is null then
    raise exception 'append_schedule_event called without an authenticated company context';
  end if;

  -- RQ6 (the real gate; the route's MANAGER_ONLY_EVENT_TYPES is an early-400 mirror — KEEP IN SYNC with
  -- src/app/api/schedule/events/route.ts). A manager-only event type requires CEO/COO/admin. Employee types
  -- (TIMEOFF_REQUESTED / AVAILABILITY_SET / SWAP_REQUESTED) are intentionally NOT listed — open to members.
  -- Service-role / definer contexts (current_user = owner) bypass.
  if current_user in ('authenticated', 'anon')
     and p_type in (
       'SHIFT_DEFINED', 'SHIFT_PUBLISHED', 'SHIFT_UNPUBLISHED', 'SHIFT_CANCELLED',
       'EMPLOYEE_ASSIGNED', 'EMPLOYEE_UNASSIGNED',
       'TIMEOFF_APPROVED', 'TIMEOFF_DENIED',
       'COVERAGE_REQ_DEFINED', 'COVERAGE_REQ_CHANGED', 'COVERAGE_REQ_REMOVED',
       'SWAP_APPROVED'
     )
     and not auth_is_schedule_manager(v_company_id) then
    raise exception 'Only a manager (CEO/COO/admin) can append schedule event type %', p_type
      using errcode = '42501';
  end if;

  insert into schedule_event (company_id, type, actor_id, payload)
    values (v_company_id, p_type, auth.uid(), p_payload)
    returning id into v_id;

  return v_id;
end;
$$;

create or replace function apply_schedule_import(
  p_new_staff       text[],
  p_shifts          jsonb,
  p_assignments     jsonb,
  p_cancel_shift_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_company        uuid := auth_company_id();
  v_name           text;
  v_shift          jsonb;
  v_assign         jsonb;
  v_cancel_id      uuid;
  v_name_to_id     jsonb := '{}'::jsonb;
  v_key_to_shift   jsonb := '{}'::jsonb;
  v_emp_id         uuid;
  v_shift_id       uuid;
  v_staff_created  int := 0;
  v_shifts_created int := 0;
  v_assigns        int := 0;
  v_cancelled      int := 0;
  r                record;
begin
  if v_company is null then
    raise exception 'apply_schedule_import called without an authenticated company context';
  end if;

  -- RQ6: importing a schedule creates manager-only events (SHIFT_DEFINED / EMPLOYEE_ASSIGNED /
  -- SHIFT_CANCELLED), so it requires a manager. Service-role / definer contexts bypass.
  if current_user in ('authenticated', 'anon') and not auth_is_schedule_manager(v_company) then
    raise exception 'Only a manager (CEO/COO/admin) can import a schedule'
      using errcode = '42501';
  end if;

  if p_cancel_shift_ids is not null then
    foreach v_cancel_id in array p_cancel_shift_ids loop
      insert into schedule_event (company_id, type, actor_id, payload)
        values (v_company, 'SHIFT_CANCELLED', auth.uid(), jsonb_build_object('shiftId', v_cancel_id));
      v_cancelled := v_cancelled + 1;
    end loop;
  end if;

  for r in select id, lower(trim(name)) as n from schedule_employee where company_id = v_company loop
    v_name_to_id := v_name_to_id || jsonb_build_object(r.n, to_jsonb(r.id));
  end loop;

  if p_new_staff is not null then
    foreach v_name in array p_new_staff loop
      insert into schedule_employee (company_id, name, status)
        values (v_company, v_name, 'active')
        returning id into v_emp_id;
      v_name_to_id := v_name_to_id || jsonb_build_object(lower(trim(v_name)), to_jsonb(v_emp_id));
      v_staff_created := v_staff_created + 1;
    end loop;
  end if;

  for v_shift in select * from jsonb_array_elements(coalesce(p_shifts, '[]'::jsonb)) loop
    v_shift_id := gen_random_uuid();
    insert into schedule_event (company_id, type, actor_id, payload)
      values (v_company, 'SHIFT_DEFINED', auth.uid(),
        jsonb_build_object('shiftId', v_shift_id, 'date', v_shift->>'date',
          'start', v_shift->>'start', 'end', v_shift->>'end', 'requiredHeadcount', 1));
    v_key_to_shift := v_key_to_shift || jsonb_build_object(v_shift->>'key', to_jsonb(v_shift_id));
    v_shifts_created := v_shifts_created + 1;
  end loop;

  for v_assign in select * from jsonb_array_elements(coalesce(p_assignments, '[]'::jsonb)) loop
    v_shift_id := nullif(v_key_to_shift->>(v_assign->>'shiftKey'), '')::uuid;
    v_emp_id   := nullif(v_name_to_id->>lower(trim(v_assign->>'staffName')), '')::uuid;
    if v_shift_id is null or v_emp_id is null then continue; end if;
    insert into schedule_event (company_id, type, actor_id, payload)
      values (v_company, 'EMPLOYEE_ASSIGNED', auth.uid(),
        jsonb_build_object('shiftId', v_shift_id, 'employeeId', v_emp_id));
    v_assigns := v_assigns + 1;
  end loop;

  return jsonb_build_object('staffCreated', v_staff_created, 'shiftsCreated', v_shifts_created,
    'assignmentsCreated', v_assigns, 'shiftsSuperseded', v_cancelled);
end;
$$;
