import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { extractAndResolveVa } from "@/lib/schedule/vaImport";
import { planImport } from "@/lib/schedule/importPlanner";
import { UnsupportedFormatError, EmptyExtractionError, DecompressionLimitError } from "@/lib/documents/extractText";

/**
 * Schedule Management System — VA presence-grid upload COMMIT (Phase 5; R-VA-3).
 *
 * Applies a CONFIRMED VA import: re-extracts the grid from the file + re-resolves for the target week
 * DETERMINISTICALLY (never trusts a client-supplied plan — same discipline as the CSV commit), refuses if
 * any time-block is still unparsed, then creates new staff + appends SHIFT_DEFINED + EMPLOYEE_ASSIGNED via
 * the ATOMIC apply_schedule_import RPC (one transaction; a 500 means nothing was written).
 *
 * Manager-only; auth-first; format allowlist + bomb guard (in the extractor); CWE-209 generic errors.
 */
export const maxDuration = 60;

const Body = z.object({
  fileBase64: z.string().min(1).max(6_000_000),
  filename: z.string().min(1).max(255),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weekdayOffsets: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "schedule-upload-va-commit", windowMs: 60_000, max: 10 });
  if (limited) return limited;

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: "Only a manager can import a schedule." }, { status: 403 });

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(Buffer.from(body.fileBase64, "base64"));
  } catch {
    return NextResponse.json({ error: "Couldn't read the uploaded file." }, { status: 400 });
  }

  let preview, unparsedBlocks;
  try {
    // Deterministic re-extract (never trust a client plan) — the SAME helper the preview used.
    ({ preview, unparsedBlocks } = await extractAndResolveVa(bytes, body.filename, {
      weekStart: body.weekStart,
      weekdayOffsets: body.weekdayOffsets,
    }));
  } catch (e) {
    if (e instanceof UnsupportedFormatError) return NextResponse.json({ error: e.message }, { status: 415 });
    if (e instanceof EmptyExtractionError)
      return NextResponse.json({ error: "No schedule table was found in that file." }, { status: 422 });
    if (e instanceof DecompressionLimitError)
      return NextResponse.json({ error: "That file expands to too much content to process safely." }, { status: 413 });
    console.error("[schedule/upload/va/commit] extraction failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Couldn't read that schedule file." }, { status: 500 });
  }

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
