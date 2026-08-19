-- 0222 — Schedule Management System, Phase 5: ATOMIC schedule import (audit 2026-08-19).
--
-- The upload/commit route created staff + appended events with separate statements, so a mid-commit
-- failure left a PARTIAL import (proactive-audit finding). A plpgsql function runs in a single
-- transaction and rolls back WHOLESALE on any error, so this applies the planned import atomically:
-- create the new staff, append one SHIFT_DEFINED per unique shift, then one EMPLOYEE_ASSIGNED per
-- assignment — all or nothing. The PLANNING stays in TypeScript (importPlanner); this only APPLIES a
-- pre-computed plan, so there is no logic duplicated in SQL to drift.
--
-- security invoker: company is auth_company_id() (never a parameter), and the append respects the same
-- append-only trigger + RLS as a normal event. A non-member or missing company context raises.

create or replace function apply_schedule_import(
  p_new_staff   text[],   -- names to create (already de-duped vs the roster by the planner)
  p_shifts      jsonb,    -- [{ "key": "...", "date": "YYYY-MM-DD", "start": "HH:mm", "end": "HH:mm" }]
  p_assignments jsonb     -- [{ "shiftKey": "...", "staffName": "..." }]
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
  v_name_to_id     jsonb := '{}'::jsonb;  -- lower(trim(name)) -> employee id
  v_key_to_shift   jsonb := '{}'::jsonb;  -- shiftKey -> generated shift id
  v_emp_id         uuid;
  v_shift_id       uuid;
  v_staff_created  int := 0;
  v_shifts_created int := 0;
  v_assigns        int := 0;
  r                record;
begin
  if v_company is null then
    raise exception 'apply_schedule_import called without an authenticated company context';
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

  return jsonb_build_object('staffCreated', v_staff_created, 'shiftsCreated', v_shifts_created, 'assignmentsCreated', v_assigns);
end;
$$;
