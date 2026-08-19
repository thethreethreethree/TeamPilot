import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { parseCsvToGrid } from "@/lib/schedule/csvGrid";
import { parseScheduleGrid } from "@/lib/schedule/gridParser";
import { planImport } from "@/lib/schedule/importPlanner";

/**
 * Schedule Management System — Phase 5 file-upload COMMIT (S3). Applies a CONFIRMED import: creates any new
 * staff, then appends SHIFT_DEFINED + EMPLOYEE_ASSIGNED events (an OFF is the absence of a shift, so it
 * produces nothing). Re-parses the same CSV+map deterministically (never trusts a client-supplied plan) and
 * REFUSES to commit if any code is unmapped (matches the preview's readyToCommit — no silent/guessed import).
 *
 * Manager-only. Roster rows are RLS-scoped (company from session); events go through append_schedule_event
 * (security-invoker, company from session). NOTE (idempotency): this assumes an import-once; re-importing the
 * same CSV would append duplicate shifts (append-only). Re-import de-duplication is a tracked follow-up.
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

  // Existing roster (name -> id), RLS-scoped to the caller's company.
  const { data: existing, error: rosterErr } = await sb
    .from("schedule_employee")
    .select("id, name")
    .eq("company_id", ctx.companyId);
  if (rosterErr) {
    console.error("[schedule/upload/commit] roster read failed:", rosterErr.message);
    return NextResponse.json({ error: "Couldn't read the roster." }, { status: 500 });
  }
  const idByName = new Map<string, string>();
  for (const r of existing ?? []) idByName.set(String(r.name).trim().toLowerCase(), r.id as string);

  const plan = planImport({ staff: parsed.staff, entries: parsed.entries }, (existing ?? []).map((r) => r.name as string));

  // 1. Create new staff (manager-gated already; RLS pins company_id on the insert's with-check).
  let staffCreated = 0;
  for (const name of plan.newStaff) {
    const { data, error } = await sb
      .from("schedule_employee")
      .insert({ company_id: ctx.companyId, name, status: "active" })
      .select("id, name")
      .single();
    if (error || !data) {
      console.error("[schedule/upload/commit] staff insert failed:", error?.message);
      return NextResponse.json({ error: `Couldn't create staff member "${name}".` }, { status: 500 });
    }
    idByName.set(String(data.name).trim().toLowerCase(), data.id as string);
    staffCreated++;
  }

  // 2. Append SHIFT_DEFINED per unique shift; keep key -> shiftId.
  const shiftIdByKey = new Map<string, string>();
  let shiftsCreated = 0;
  for (const s of plan.shifts) {
    const shiftId = crypto.randomUUID();
    const { error } = await sb.rpc("append_schedule_event", {
      p_type: "SHIFT_DEFINED",
      p_payload: { shiftId, date: s.date, start: s.start, end: s.end, requiredHeadcount: 1 },
    });
    if (error) {
      console.error("[schedule/upload/commit] shift append failed:", error.message);
      return NextResponse.json({ error: "Couldn't record an imported shift." }, { status: 500 });
    }
    shiftIdByKey.set(s.key, shiftId);
    shiftsCreated++;
  }

  // 3. Append EMPLOYEE_ASSIGNED per assignment.
  let assignmentsCreated = 0;
  for (const a of plan.assignments) {
    const shiftId = shiftIdByKey.get(a.shiftKey);
    const employeeId = idByName.get(a.staffName.trim().toLowerCase());
    if (!shiftId || !employeeId) continue; // defensive — a name/shift we couldn't resolve is skipped, not guessed
    const { error } = await sb.rpc("append_schedule_event", {
      p_type: "EMPLOYEE_ASSIGNED",
      p_payload: { shiftId, employeeId },
    });
    if (error) {
      console.error("[schedule/upload/commit] assignment append failed:", error.message);
      return NextResponse.json({ error: "Couldn't record an imported assignment." }, { status: 500 });
    }
    assignmentsCreated++;
  }

  return NextResponse.json({ staffCreated, shiftsCreated, assignmentsCreated }, { status: 201 });
}
