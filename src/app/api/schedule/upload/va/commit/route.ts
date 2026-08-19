import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { VaUploadBody, extractVaOrError } from "@/lib/schedule/vaUpload";
import { planImport } from "@/lib/schedule/importPlanner";

/**
 * Schedule Management System — VA presence-grid upload COMMIT (Phase 5; R-VA-3).
 *
 * Applies a CONFIRMED VA import: re-extracts the grid from the file + re-resolves for the target week
 * DETERMINISTICALLY (never trusts a client-supplied plan — same discipline as the CSV commit; the shared
 * extractVaOrError does the same parse the preview did), refuses if any time-block is still unparsed, then
 * creates new staff + appends SHIFT_DEFINED + EMPLOYEE_ASSIGNED via the ATOMIC apply_schedule_import RPC
 * (one transaction; a 500 means nothing was written).
 *
 * Manager-only; auth-first; format allowlist + bomb guard; CWE-209 generic errors.
 */
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "schedule-upload-va-commit", windowMs: 60_000, max: 10 });
  if (limited) return limited;

  const body = await readBody(req, VaUploadBody);
  if (body instanceof NextResponse) return body;

  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: "Only a manager can import a schedule." }, { status: 403 });

  // Deterministic re-extract (never trust a client plan) — the SAME helper + mapping the preview used.
  const res = await extractVaOrError(body, "schedule/upload/va/commit");
  if (res instanceof NextResponse) return res;
  const { preview, unparsedBlocks } = res;

  if (unparsedBlocks.length > 0) {
    return NextResponse.json(
      { error: "Some time blocks couldn't be read — fix them before importing.", unparsedBlocks },
      { status: 400 },
    );
  }
  if (preview.entries.length === 0) {
    return NextResponse.json({ error: "That schedule has no shifts to import." }, { status: 400 });
  }

  const sb = await createClient();
  const { data: existing, error: rosterErr } = await sb
    .from("schedule_employee")
    .select("name")
    .eq("company_id", ctx.companyId);
  if (rosterErr) {
    console.error("[schedule/upload/va/commit] roster read failed:", rosterErr.message);
    return NextResponse.json({ error: "Couldn't read the roster." }, { status: 500 });
  }

  const plan = planImport(preview, (existing ?? []).map((r) => r.name as string));

  const { data: result, error } = await sb.rpc("apply_schedule_import", {
    p_new_staff: plan.newStaff,
    p_shifts: plan.shifts,
    p_assignments: plan.assignments,
  });
  if (error) {
    console.error("[schedule/upload/va/commit] atomic import failed:", error.message);
    return NextResponse.json({ error: "Couldn't import the schedule. Nothing was changed." }, { status: 500 });
  }

  const r = (result ?? {}) as { staffCreated?: number; shiftsCreated?: number; assignmentsCreated?: number };
  return NextResponse.json(
    { staffCreated: r.staffCreated ?? 0, shiftsCreated: r.shiftsCreated ?? 0, assignmentsCreated: r.assignmentsCreated ?? 0 },
    { status: 201 },
  );
}
