import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { fetchAllPaged } from "@/lib/supabase/paginate";
import { EVENT_COLUMNS, rowToEvent, type EventRow } from "@/lib/schedule/eventRow";
import { EMPLOYEE_COLUMNS, rowToEmployee, type EmployeeRow } from "@/lib/schedule/employeeRow";
import { deriveState } from "@/lib/schedule/deriveState";
import { personalSchedule } from "@/lib/schedule/personalSchedule";
import { getScheduleSettings, todayInTz } from "@/lib/schedule/settings";

/**
 * Schedule Management System — Phase 6, one employee's personal schedule (manager-entered model).
 *
 * GET ?employeeId=… → { employee: {name, role}, schedule } for a printable per-person view. The
 * founder chose "no login yet" (2026-08-20): a MANAGER pulls up / prints an employee's schedule, so
 * this is MANAGER-ONLY (ctx.isAdmin) and company-scoped — consistent with Grid/Coverage. The employee
 * lookup is pinned to the caller's company (auth_company_id via RLS + explicit eq), so a manager can
 * only view their own company's staff. Read-only; no events appended.
 */
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const employeeId = new URL(req.url).searchParams.get("employeeId") ?? "";
  if (!z.string().uuid().safeParse(employeeId).success) {
    return NextResponse.json({ error: "Invalid employee id." }, { status: 400 });
  }

  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: "Only a manager can view an employee's schedule." }, { status: 403 });

  const sb = await createClient();
  try {
    // Confirm the employee belongs to the caller's company (explicit eq on top of RLS) before deriving —
    // a 404 for a stranger id, never another company's staff.
    const { data: empRow } = await sb
      .from("schedule_employee")
      .select(EMPLOYEE_COLUMNS)
      .eq("company_id", ctx.companyId)
      .eq("id", employeeId)
      .maybeSingle();
    if (!empRow) return NextResponse.json({ error: "That staff member isn't on your roster." }, { status: 404 });
    const employee = rowToEmployee(empRow as EmployeeRow);

    const [evRows, settings] = await Promise.all([
      fetchAllPaged<EventRow>(
        (from, to) => sb.from("schedule_event").select(EVENT_COLUMNS).eq("company_id", ctx.companyId).order("seq", { ascending: true }).range(from, to),
        { label: "schedule_event personal" },
      ),
      getScheduleSettings(sb, ctx.companyId),
    ]);
    const state = deriveState(evRows.map(rowToEvent));
    const today = todayInTz(settings.timezone);
    const schedule = personalSchedule(state, employeeId, today);

    return NextResponse.json({
      employee: { id: employee.id, name: employee.name, role: employee.role },
      schedule,
    });
  } catch (e) {
    console.error("[schedule/personal] read failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Couldn't load the schedule." }, { status: 500 });
  }
}
