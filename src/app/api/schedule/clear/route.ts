import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { readExistingShifts } from "@/lib/schedule/commitImport";

/**
 * Schedule Management System — clear the schedule (delete every shift). Manager-only.
 *
 * Event-sourced + APPEND-ONLY (§3.1): "delete" is not a row deletion — it appends a SHIFT_CANCELLED for every
 * currently-live shift, so the derived schedule becomes empty while the full history stays intact. It reuses
 * the ATOMIC apply_schedule_import RPC (0223) with ONLY cancellations (no new staff/shifts/assignments), so the
 * whole clear runs in one transaction and rolls back wholesale on failure. The roster + coverage requirements
 * are untouched (this clears the schedule, not the team) — staff are managed on the roster.
 *
 * The current shift ids are derived from the log HERE (the projector is the single source of "what exists");
 * the RPC only applies the pre-computed cancel set (§2.2).
 */
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "schedule-clear", windowMs: 60_000, max: 10 });
  if (limited) return limited;

  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: "Only a manager can clear the schedule." }, { status: 403 });

  const sb = await createClient();
  let shiftIds: string[];
  try {
    shiftIds = (await readExistingShifts(sb, ctx.companyId)).map((s) => s.id);
  } catch (e) {
    console.error("[schedule/clear] read failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Couldn't read the schedule to clear it." }, { status: 500 });
  }

  if (shiftIds.length === 0) return NextResponse.json({ cleared: 0 }, { status: 200 });

  // Atomic: cancel every live shift, add nothing. Reuses the tested replace-the-week RPC (empty import).
  const { error } = await sb.rpc("apply_schedule_import", {
    p_new_staff: [],
    p_shifts: [],
    p_assignments: [],
    p_cancel_shift_ids: shiftIds,
  });
  if (error) {
    // If the p_cancel_shift_ids parameter is missing, migration 0223 isn't applied — fail loud (§1.5.3), never
    // pretend the schedule was cleared.
    const missingParam = error.code === "PGRST202" || /p_cancel_shift_ids|could not find/i.test(error.message ?? "");
    console.error("[schedule/clear] clear failed:", error.message);
    return NextResponse.json(
      { error: missingParam ? "The clear feature needs a database update (migration 0223)." : "Couldn't clear the schedule. Nothing was changed." },
      { status: missingParam ? 503 : 500 },
    );
  }

  return NextResponse.json({ cleared: shiftIds.length }, { status: 200 });
}
