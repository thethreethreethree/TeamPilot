import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { EMPLOYEE_COLUMNS, rowToEmployee, type EmployeeRow } from "@/lib/schedule/employeeRow";

/**
 * Schedule Management System — update a staff member (Phase 5 roster CRUD; closes the R5-1 follow-up).
 *
 * PATCH → edit a staff member's mutable fields, most importantly status active↔inactive: a departed
 *         employee is DEACTIVATED so `isEligible` stops scheduling them (the roster was add-only before, so
 *         a departed employee stayed "active" forever). MANAGER-ONLY; the update is pinned to the caller's
 *         company (id AND company_id) so a manager can never edit another company's staff (defense-in-depth
 *         beyond RLS — INV15 / tenant-pin). A no-match (wrong id, or another company's staff) is a 404,
 *         never a cross-tenant edit.
 */

const PatchInput = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    role: z.string().trim().max(60).nullish(),
    employmentType: z.string().trim().max(40).nullish(),
    skills: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
    certifications: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
    maxHoursWeek: z.number().nonnegative().max(168).nullish(),
    minHoursWeek: z.number().nonnegative().max(168).nullish(),
    status: z.enum(["active", "inactive"]).optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), { message: "No fields to update." });

const idSchema = z.string().uuid();

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "schedule-employee-update", windowMs: 60_000, max: 120 });
  if (limited) return limited;

  const { id } = await params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "Invalid staff id." }, { status: 400 });

  const body = await readBody(req, PatchInput);
  if (body instanceof NextResponse) return body;

  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: "Only a manager can update staff." }, { status: 403 });

  // Only the fields that were sent (a partial update); nullish fields map an explicit null through.
  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.role !== undefined) patch.role = body.role ?? null;
  if (body.employmentType !== undefined) patch.employment_type = body.employmentType ?? null;
  if (body.skills !== undefined) patch.skills = body.skills;
  if (body.certifications !== undefined) patch.certifications = body.certifications;
  if (body.maxHoursWeek !== undefined) patch.max_hours_week = body.maxHoursWeek ?? null;
  if (body.minHoursWeek !== undefined) patch.min_hours_week = body.minHoursWeek ?? null;
  if (body.status !== undefined) patch.status = body.status;

  const sb = await createClient();
  const { data, error } = await sb
    .from("schedule_employee")
    .update(patch)
    .eq("id", id)
    .eq("company_id", ctx.companyId) // tenant-pin: an update can only touch the caller's own company's staff
    .select(EMPLOYEE_COLUMNS)
    .maybeSingle();
  if (error) {
    console.error("[schedule/employees/:id] update failed:", error.message);
    return NextResponse.json({ error: "Couldn't update the staff member." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });
  return NextResponse.json({ employee: rowToEmployee(data as EmployeeRow) });
}
