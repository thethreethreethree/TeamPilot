import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { parseCsvToGrid } from "@/lib/schedule/csvGrid";
import { parseScheduleGrid, MAX_GRID_ROWS } from "@/lib/schedule/gridParser";
import { planImport } from "@/lib/schedule/importPlanner";
import { commitImport } from "@/lib/schedule/commitImport";
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
 * REPLACE-THE-WEEK (0223, founder decision 2026-08-19): re-importing supersedes the existing shifts in the
 * imported date span (SHIFT_CANCELLED, same transaction) before inserting — so a re-uploaded correction
 * replaces the week instead of stacking duplicates. The shared commitImport helper owns that semantic.
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
  // Same bound the preview enforces — reject an oversized grid BEFORE the rows × headerDates expansion (§3.4 honest
  // 413, not an OOM). Kept in lockstep with preview via the shared MAX_GRID_ROWS.
  if (grid.rows.length > MAX_GRID_ROWS) {
    return NextResponse.json(
      { error: `That schedule has ${grid.rows.length} staff rows — the import limit is ${MAX_GRID_ROWS}. Split it into smaller files.` },
      { status: 413 },
    );
  }
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

  // Apply the whole import ATOMICALLY (0222) with the replace-the-week semantic (0223): supersede existing
  // shifts in the imported span, then create staff + append SHIFT_DEFINED + EMPLOYEE_ASSIGNED — all in ONE
  // transaction. Shared helper so the CSV + VA routes can't drift; planning stays in TS (planImport above).
  const outcome = await commitImport(sb, ctx.companyId, plan);
  if (!outcome.ok) {
    if (outcome.code === "MIGRATION_REQUIRED") {
      return NextResponse.json(
        { error: "Replace-the-week re-import needs a database update that isn't applied yet. Nothing was changed." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Couldn't import the schedule. Nothing was changed." }, { status: 500 });
  }

  return NextResponse.json(
    {
      staffCreated: outcome.staffCreated,
      shiftsCreated: outcome.shiftsCreated,
      assignmentsCreated: outcome.assignmentsCreated,
      shiftsSuperseded: outcome.shiftsSuperseded,
    },
    { status: 201 },
  );
}
