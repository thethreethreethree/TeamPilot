import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { fetchAllPaged } from "@/lib/supabase/paginate";
import type { Employee } from "@/lib/schedule/types";

/**
 * Schedule Management System — Phase 5: the staff roster API (schedule_employee, 0221).
 *
 * GET  → the company's roster (RLS-scoped; any company member may read).
 * POST → create a staff member. MANAGER-ONLY (ctx.isAdmin) — this closes RQ6/S2: the roster write path,
 *        gated so a non-manager company member cannot add/alter staff. The manual add-form AND the
 *        PDF/Excel/CSV import both write through here (or its bulk sibling).
 *
 * Staff are STANDALONE (no Elostate account); company_id comes from the session, never the body.
 */

const EmployeeInput = z.object({
  name: z.string().trim().min(1).max(120),
  role: z.string().trim().max(60).nullish(),
  employmentType: z.string().trim().max(40).nullish(),
  skills: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
  certifications: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
  maxHoursWeek: z.number().nonnegative().max(168).nullish(),
  minHoursWeek: z.number().nonnegative().max(168).nullish(),
  status: z.enum(["active", "inactive"]).optional(),
});

type Row = {
  id: string; company_id: string; name: string; role: string | null; employment_type: string | null;
  skills: string[] | null; certifications: string[] | null; max_hours_week: number | null;
  min_hours_week: number | null; status: string;
};

function toEmployee(r: Row): Employee {
  return {
    id: r.id, companyId: r.company_id, name: r.name, role: r.role, employmentType: r.employment_type,
    skills: r.skills ?? [], certifications: r.certifications ?? [],
    maxHoursWeek: r.max_hours_week, minHoursWeek: r.min_hours_week,
    status: r.status === "inactive" ? "inactive" : "active",
  };
}

export async function GET(_req: NextRequest) {
  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const sb = await createClient();
  try {
    const rows = await fetchAllPaged<Row>(
      (from, to) =>
        sb
          .from("schedule_employee")
          .select("id, company_id, name, role, employment_type, skills, certifications, max_hours_week, min_hours_week, status")
          .eq("company_id", ctx.companyId)
          .order("name", { ascending: true })
          .range(from, to),
      { label: "schedule_employee roster" },
    );
    return NextResponse.json({ employees: rows.map(toEmployee) });
  } catch (e) {
    console.error("[schedule/employees] read failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Couldn't load the roster." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "schedule-employee-create", windowMs: 60_000, max: 120 });
  if (limited) return limited;

  const body = await readBody(req, EmployeeInput);
  if (body instanceof NextResponse) return body;

  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  // RQ6 manager-only write gate: only a company admin/manager may add staff.
  if (!ctx.isAdmin) return NextResponse.json({ error: "Only a manager can add staff." }, { status: 403 });

  const sb = await createClient();
  const { data, error } = await sb
    .from("schedule_employee")
    .insert({
      company_id: ctx.companyId, // server-resolved, never from the body (tenant-pin)
      name: body.name,
      role: body.role ?? null,
      employment_type: body.employmentType ?? null,
      skills: body.skills ?? [],
      certifications: body.certifications ?? [],
      max_hours_week: body.maxHoursWeek ?? null,
      min_hours_week: body.minHoursWeek ?? null,
      status: body.status ?? "active",
    })
    .select("id, company_id, name, role, employment_type, skills, certifications, max_hours_week, min_hours_week, status")
    .single();
  if (error || !data) {
    console.error("[schedule/employees] create failed:", error?.message);
    return NextResponse.json({ error: "Couldn't add the staff member." }, { status: 500 });
  }
  return NextResponse.json({ employee: toEmployee(data as Row) }, { status: 201 });
}
