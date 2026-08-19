import type { createClient } from "@/lib/supabase/server";
import { fetchAllPaged } from "@/lib/supabase/paginate";
import { deriveState } from "./deriveState";
import { EVENT_COLUMNS, rowToEvent, type EventRow } from "./eventRow";
import { supersededShiftIds, type ImportPlan } from "./importPlanner";

type SbClient = Awaited<ReturnType<typeof createClient>>;

export type CommitImportResult =
  | { ok: true; staffCreated: number; shiftsCreated: number; assignmentsCreated: number; shiftsSuperseded: number }
  | { ok: false; code: "READ_FAILED" | "MIGRATION_REQUIRED" | "FAILED" };

const num = (o: unknown, k: string): number => {
  const v = (o as Record<string, unknown> | null)?.[k];
  return typeof v === "number" ? v : 0;
};

/**
 * The company's currently-live shifts (id + date), derived from the event log — the single source of "what
 * shifts exist". Shared by the commit (to compute the replace-the-week supersede set) and the preview (to
 * warn how many shifts a re-import will replace), so the pre-commit count and the actual commit can't drift.
 */
export async function readExistingShifts(sb: SbClient, companyId: string): Promise<{ id: string; date: string }[]> {
  const evRows = await fetchAllPaged<EventRow>(
    (from, to) =>
      sb.from("schedule_event").select(EVENT_COLUMNS).eq("company_id", companyId).order("seq", { ascending: true }).range(from, to),
    { label: "schedule_event (existing shifts)" },
  );
  const state = deriveState(evRows.map(rowToEvent));
  return Object.values(state.shifts).map((s) => ({ id: s.id, date: s.date }));
}

/**
 * Apply a planned import ATOMICALLY with the founder's replace-the-week semantic (2026-08-19): existing
 * shifts in the imported date SPAN are superseded (SHIFT_CANCELLED) in the SAME transaction as the insert,
 * so a re-uploaded correction replaces the week rather than stacking duplicates. Shared by the CSV and VA
 * commit routes so the semantic cannot drift between them.
 *
 * The supersede ids are computed HERE from derived state (the projector is the single source of "what shifts
 * exist"); apply_schedule_import only APPLIES the pre-computed decision (§2.2 — the RPC doesn't re-derive it).
 *
 * Fail-loud (§1.5.3): replace-the-week needs migration 0223 (the p_cancel_shift_ids parameter). If there is
 * something to supersede but the RPC lacks the parameter (migration not yet applied), return
 * MIGRATION_REQUIRED rather than SILENTLY appending the duplicates the founder chose to avoid. When there is
 * nothing to supersede, the legacy 3-arg call is identical, so a first import is never blocked on the migration.
 */
export async function commitImport(
  sb: SbClient,
  companyId: string,
  plan: ImportPlan,
): Promise<CommitImportResult> {
  // Current shifts (to bound the replace-the-week span) — derived from the log, the single source of truth.
  let existingShifts: { id: string; date: string }[];
  try {
    existingShifts = await readExistingShifts(sb, companyId);
  } catch (e) {
    console.error("[schedule/commitImport] event read failed:", e instanceof Error ? e.message : e);
    return { ok: false, code: "READ_FAILED" };
  }

  const cancelIds = supersededShiftIds(existingShifts, plan.shifts);

  const { data, error } = await sb.rpc("apply_schedule_import", {
    p_new_staff: plan.newStaff,
    p_shifts: plan.shifts,
    p_assignments: plan.assignments,
    p_cancel_shift_ids: cancelIds,
  });

  if (error) {
    // PGRST202 = no function matches these named args → migration 0223 (p_cancel_shift_ids) not applied.
    const missingParam = error.code === "PGRST202" || /p_cancel_shift_ids|could not find/i.test(error.message ?? "");
    if (missingParam && cancelIds.length > 0) {
      console.error("[schedule/commitImport] replace-the-week needs migration 0223 — run: npm run db:apply");
      return { ok: false, code: "MIGRATION_REQUIRED" };
    }
    if (missingParam) {
      // Nothing to supersede — the legacy 3-arg signature yields an identical result; don't block on 0223.
      const legacy = await sb.rpc("apply_schedule_import", {
        p_new_staff: plan.newStaff,
        p_shifts: plan.shifts,
        p_assignments: plan.assignments,
      });
      if (legacy.error) {
        console.error("[schedule/commitImport] atomic import failed:", legacy.error.message);
        return { ok: false, code: "FAILED" };
      }
      return {
        ok: true,
        staffCreated: num(legacy.data, "staffCreated"),
        shiftsCreated: num(legacy.data, "shiftsCreated"),
        assignmentsCreated: num(legacy.data, "assignmentsCreated"),
        shiftsSuperseded: 0,
      };
    }
    console.error("[schedule/commitImport] atomic import failed:", error.message);
    return { ok: false, code: "FAILED" };
  }

  return {
    ok: true,
    staffCreated: num(data, "staffCreated"),
    shiftsCreated: num(data, "shiftsCreated"),
    assignmentsCreated: num(data, "assignmentsCreated"),
    shiftsSuperseded: num(data, "shiftsSuperseded"),
  };
}
