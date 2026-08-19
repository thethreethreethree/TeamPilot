import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { parseCsvToGrid } from "@/lib/schedule/csvGrid";
import { parseScheduleGrid } from "@/lib/schedule/gridParser";
import { planImport } from "@/lib/schedule/importPlanner";
import { fetchAllPaged } from "@/lib/supabase/paginate";

/**
 * Schedule Management System — Phase 5 file-upload COMMIT (S3). Applies a CONFIRMED import: creates any new
 * staff, then appends SHIFT_DEFINED + EMPLOYEE_ASSIGNED events (an OFF is the absence of a shift, so it
 * produces nothing). Re-parses the same CSV+map deterministically (never trusts a client-supplied plan) and
 * REFUSES to commit if any code is unmapped (matches the preview's readyToCommit — no silent/guessed import).
 *
 * Manager-only. Roster rows are RLS-scoped (company from session); events go through append_schedule_event
 * (security-invoker, company from session).
 *
 * ATOMIC (0222, audit fix): the whole import runs inside the apply_schedule_import RPC — a single
 * transaction that rolls back wholesale on any failure. A 500 here means NOTHING was written (no partial
 * import). Planning stays in TS (importPlanner); the RPC only applies the plan.
 *
 * KNOWN GAP (tracked): IDEMPOTENCY — import-once is assumed; re-importing the same CSV appends duplicate
 * shifts (append-only). Re-import de-duplication (a shift key already present → skip) is a follow-up.
 */
export const maxDuration = 60;

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const Body = z.object({
  csv: z.string().min(1).max(1_000_000),
  headerDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1).max(400),
  codeMap: z.record(z.string().min(1).max(40), z.union([z.object({ start: hhmm, end: hhmm }), z.literal("off")])).default({}),
  headerRowIndex: z.number().int().nonnegative().max(50).optional(),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "schedule-upload-commit", windowMs: 60_000, max: 10 });
  if (limited) return limited;

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: "Only a manager can import a schedule." }, { status: 403 });

  // Deterministic re-parse (never trust a client plan).
  const grid = parseCsvToGrid(body.csv, { headerRowIndex: body.headerRowIndex });
  const parsed = parseScheduleGrid({ headerDates: body.headerDates, rows: grid.rows, codeMap: body.codeMap });
  if (parsed.unknownCodes.length > 0) {
    return NextResponse.json(
      { error: "Some shift codes are still unmapped — map them before importing.", unknownCodes: parsed.unknownCodes },
      { status: 400 },
    );
  }

  const sb = await createClient();

  // Existing roster names → the planner decides who's new. PAGED past the 1000-row PostgREST cap: a
  // truncated roster would make staff beyond row 1000 look "new" and create DUPLICATE records on import
  // (the unbounded-select class). RLS-scoped to the caller's company; ordered by id for stable paging.
  let existingNames: string[];
  try {
    const rows = await fetchAllPaged<{ name: string }>(
      (from, to) =>
        sb.from("schedule_employee").select("name").eq("company_id", ctx.companyId).order("id").range(from, to),
      { label: "schedule roster" },
    );
    existingNames = rows.map((r) => r.name);
  } catch (e) {
    console.error("[schedule/upload/commit] roster read failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Couldn't read the roster." }, { status: 500 });
  }
  const plan = planImport({ staff: parsed.staff, entries: parsed.entries }, existingNames);

  // Apply the whole import ATOMICALLY (0222): create staff + append SHIFT_DEFINED + EMPLOYEE_ASSIGNED in ONE
  // transaction that rolls back wholesale on any failure — no partial import (the audit fix). Planning stays
  // in TS (planImport above); the RPC only applies the plan.
  const { data: result, error } = await sb.rpc("apply_schedule_import", {
    p_new_staff: plan.newStaff,
    p_shifts: plan.shifts,
    p_assignments: plan.assignments,
  });
  if (error) {
    console.error("[schedule/upload/commit] atomic import failed:", error.message);
    return NextResponse.json({ error: "Couldn't import the schedule. Nothing was changed." }, { status: 500 });
  }

  const r = (result ?? {}) as { staffCreated?: number; shiftsCreated?: number; assignmentsCreated?: number };
  return NextResponse.json(
    { staffCreated: r.staffCreated ?? 0, shiftsCreated: r.shiftsCreated ?? 0, assignmentsCreated: r.assignmentsCreated ?? 0 },
    { status: 201 },
  );
}
