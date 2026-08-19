import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { VaUploadBody, extractVaOrError } from "@/lib/schedule/vaUpload";
import { planImport } from "@/lib/schedule/importPlanner";
import { commitImport } from "@/lib/schedule/commitImport";
import { fetchAllPaged } from "@/lib/supabase/paginate";

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
  // Existing roster names, PAGED past the 1000-row cap (a truncated roster → duplicate staff on import —
  // the unbounded-select class). RLS-scoped to the caller's company; ordered by id for stable paging.
  let existingNames: string[];
  try {
    const rows = await fetchAllPaged<{ name: string }>(
      (from, to) =>
        sb.from("schedule_employee").select("name").eq("company_id", ctx.companyId).order("id").range(from, to),
      { label: "schedule roster" },
    );
    existingNames = rows.map((r) => r.name);
  } catch (e) {
    console.error("[schedule/upload/va/commit] roster read failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Couldn't read the roster." }, { status: 500 });
  }

  const plan = planImport(preview, existingNames);

  // Replace-the-week + atomic (shared helper — same semantic as the CSV route, no drift).
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
