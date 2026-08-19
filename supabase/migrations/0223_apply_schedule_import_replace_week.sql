-- 0223 — Schedule Management System, Phase 5: replace-the-week re-import (founder decision 2026-08-19).
--
-- Re-importing the same week used to APPEND, stacking duplicate shifts on top of the originals. The founder
-- chose "replace-the-week": a re-import supersedes the existing shifts in the imported date span, then adds
-- the new ones. This extends apply_schedule_import with p_cancel_shift_ids — the ids (computed in TypeScript
-- by supersededShiftIds, the planner stays the single source of that decision) of existing shifts to cancel
-- FIRST, in the SAME transaction as the insert, so a re-import is atomic: it never leaves the week half-empty.
--
-- The new parameter has a DEFAULT '{}', so the existing 3-arg call signature keeps working unchanged (a
-- first import, or a caller that computed nothing to supersede, passes no cancel ids). A cancel is an
-- append-only SHIFT_CANCELLED event (the projector drops the shift from derived state); the log stays intact.
--
-- security invoker: company is auth_company_id() (never a parameter); the appends respect the same
-- append-only trigger + RLS as any event.

create or replace function apply_schedule_import(
  p_new_staff       text[],   -- names to create (already de-duped vs the roster by the planner)
  p_shifts          jsonb,    -- [{ "key": "...", "date": "YYYY-MM-DD", "start": "HH:mm", "end": "HH:mm" }]
  p_assignments     jsonb,    -- [{ "shiftKey": "...", "staffName": "..." }]
  p_cancel_shift_ids uuid[] default '{}'::uuid[]  -- existing shift ids to supersede (replace-the-week)
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
  v_name_to_id     jsonb := '{}'::jsonb;  -- lower(trim(name)) -> employee id
  v_key_to_shift   jsonb := '{}'::jsonb;  -- shiftKey -> generated shift id
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

  -- Replace-the-week: supersede the existing shifts in the imported span FIRST (append-only tombstones),
  -- so the new shifts below replace rather than stack. Same transaction → atomic (never a half-empty week).
  if p_cancel_shift_ids is not null then
    foreach v_cancel_id in array p_cancel_shift_ids loop
      insert into schedule_event (company_id, type, actor_id, payload)
        values (v_company, 'SHIFT_CANCELLED', auth.uid(),
          jsonb_build_object('shiftId', v_cancel_id));
      v_cancelled := v_cancelled + 1;
    end loop;
  end if;

  -- Existing roster into the name->id map (assignments may reference already-present staff).
  for r in select id, lower(trim(name)) as n from schedule_employee where company_id = v_company loop
    v_name_to_id := v_name_to_id || jsonb_build_object(r.n, to_jsonb(r.id));
  end loop;

  -- Create the new staff.
  if p_new_staff is not null then
    foreach v_name in array p_new_staff loop
      insert into schedule_employee (company_id, name, status)
        values (v_company, v_name, 'active')
        returning id into v_emp_id;
      v_name_to_id := v_name_to_id || jsonb_build_object(lower(trim(v_name)), to_jsonb(v_emp_id));
      v_staff_created := v_staff_created + 1;
    end loop;
  end if;

  -- One SHIFT_DEFINED per unique shift; remember its generated id by key.
  for v_shift in select * from jsonb_array_elements(coalesce(p_shifts, '[]'::jsonb)) loop
    v_shift_id := gen_random_uuid();
    insert into schedule_event (company_id, type, actor_id, payload)
      values (v_company, 'SHIFT_DEFINED', auth.uid(),
        jsonb_build_object('shiftId', v_shift_id, 'date', v_shift->>'date',
          'start', v_shift->>'start', 'end', v_shift->>'end', 'requiredHeadcount', 1));
    v_key_to_shift := v_key_to_shift || jsonb_build_object(v_shift->>'key', to_jsonb(v_shift_id));
    v_shifts_created := v_shifts_created + 1;
  end loop;

  -- One EMPLOYEE_ASSIGNED per assignment (skip any we cannot resolve — never guessed).
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
