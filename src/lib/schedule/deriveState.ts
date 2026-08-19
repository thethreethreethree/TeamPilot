/**
 * Schedule Management System — the projector (Phase 1, CLAUDE.md 3.1).
 *
 * `deriveState(events)` replays the immutable event log into the current schedule state. It is a
 * PURE, DETERMINISTIC function of its input: no clock, no randomness, no IO. Replaying the same log
 * always yields identical state (proven in deriveState.test.ts), which is what makes the event log
 * — not any mutable table — the source of truth. A correction is a NEW event, applied in seq order,
 * never an edit to a past one.
 *
 * Payloads arrive as untyped JSON (Record<string, unknown>) because the DB column is jsonb; every
 * field is read defensively so a malformed or partial event degrades to a no-op rather than throwing
 * mid-replay (a single bad event must not corrupt the whole projection). The append API validates
 * payloads against a schema BEFORE they are written, so well-formed events are the norm; this
 * defensiveness is the replay-robustness backstop.
 */
import type {
  ScheduleEvent,
  ScheduleState,
  Shift,
  TimeOff,
  Availability,
  CoverageRequirement,
} from "./types";

function str(p: Record<string, unknown>, k: string): string | null {
  const v = p[k];
  return typeof v === "string" && v.length > 0 ? v : null;
}
function num(p: Record<string, unknown>, k: string): number | null {
  const v = p[k];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function roleMap(p: Record<string, unknown>, k: string): Record<string, number> {
  const v = p[k];
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, number> = {};
  for (const [role, n] of Object.entries(v as Record<string, unknown>)) {
    if (typeof n === "number" && Number.isFinite(n)) out[role] = n;
  }
  return out;
}

function applyEvent(state: ScheduleState, e: ScheduleEvent): void {
  const p = e.payload ?? {};
  switch (e.type) {
    case "SHIFT_DEFINED": {
      const id = str(p, "shiftId");
      const date = str(p, "date");
      const start = str(p, "start");
      const end = str(p, "end");
      const headcount = num(p, "requiredHeadcount");
      if (!id || !date || !start || !end || headcount === null) return; // malformed → no-op
      const existing = state.shifts[id];
      const shift: Shift = {
        id,
        date,
        start,
        end,
        requiredHeadcount: headcount,
        requiredByRole: roleMap(p, "requiredByRole"),
        // redefining a shift preserves its assignments + publish status (a definition edit, not a reset)
        assigned: existing?.assigned ?? [],
        status: existing?.status ?? "draft",
      };
      state.shifts[id] = shift;
      return;
    }
    case "SHIFT_PUBLISHED": {
      const id = str(p, "shiftId");
      if (!id) return;
      const s = state.shifts[id];
      if (s) s.status = "published";
      return;
    }
    case "SHIFT_UNPUBLISHED": {
      const id = str(p, "shiftId");
      if (!id) return;
      const s = state.shifts[id];
      if (s) s.status = "draft";
      return;
    }
    case "SHIFT_CANCELLED": {
      // Tombstone: the shift no longer exists in derived state (with its assignments). Append-only — the
      // SHIFT_DEFINED stays in the log; replaying just drops the cancelled shift. A later SHIFT_DEFINED with
      // the same id would re-create it (a fresh definition), which is fine (ids are unique per creation).
      const id = str(p, "shiftId");
      if (!id) return;
      delete state.shifts[id];
      return;
    }
    case "EMPLOYEE_ASSIGNED": {
      const shiftId = str(p, "shiftId");
      const employeeId = str(p, "employeeId");
      if (!shiftId || !employeeId) return;
      const s = state.shifts[shiftId];
      if (s && !s.assigned.includes(employeeId)) s.assigned.push(employeeId);
      return;
    }
    case "EMPLOYEE_UNASSIGNED": {
      const shiftId = str(p, "shiftId");
      const employeeId = str(p, "employeeId");
      if (!shiftId || !employeeId) return;
      const s = state.shifts[shiftId];
      if (s) s.assigned = s.assigned.filter((x) => x !== employeeId);
      return;
    }
    case "SWAP_APPROVED": {
      // A swap is a reassignment: the from-employee leaves the shift, the to-employee takes it.
      const shiftId = str(p, "shiftId");
      const from = str(p, "fromEmployeeId");
      const to = str(p, "toEmployeeId");
      if (!shiftId || !from || !to) return;
      const s = state.shifts[shiftId];
      if (!s) return;
      s.assigned = s.assigned.filter((x) => x !== from);
      if (!s.assigned.includes(to)) s.assigned.push(to);
      return;
    }
    case "TIMEOFF_REQUESTED": {
      const id = str(p, "timeOffId");
      const employeeId = str(p, "employeeId");
      const type = str(p, "type");
      const start = str(p, "start");
      const end = str(p, "end");
      if (!id || !employeeId || !type || !start || !end) return;
      const to: TimeOff = {
        id,
        employeeId,
        type,
        start,
        end,
        partial: p["partial"] === true,
        status: "requested",
      };
      state.timeOff[id] = to;
      return;
    }
    case "TIMEOFF_APPROVED": {
      const id = str(p, "timeOffId");
      if (!id) return;
      const t = state.timeOff[id];
      if (t) t.status = "approved";
      return;
    }
    case "TIMEOFF_DENIED": {
      const id = str(p, "timeOffId");
      if (!id) return;
      const t = state.timeOff[id];
      if (t) t.status = "denied";
      return;
    }
    case "AVAILABILITY_SET": {
      const employeeId = str(p, "employeeId");
      if (!employeeId) return;
      const weeklyRaw = Array.isArray(p["weekly"]) ? (p["weekly"] as unknown[]) : [];
      const weekly: Availability["weekly"] = [];
      for (const w of weeklyRaw) {
        if (!w || typeof w !== "object") continue;
        const wr = w as Record<string, unknown>;
        const dayOfWeek = num(wr, "dayOfWeek");
        const from = str(wr, "from");
        const to = str(wr, "to");
        if (dayOfWeek === null || !from || !to) continue;
        weekly.push({ dayOfWeek, from, to });
      }
      const unavailableDates = Array.isArray(p["unavailableDates"])
        ? (p["unavailableDates"] as unknown[]).filter((d): d is string => typeof d === "string")
        : [];
      // AVAILABILITY_SET replaces the employee's availability wholesale (it is a full "set", not a patch).
      state.availability[employeeId] = { employeeId, weekly, unavailableDates };
      return;
    }
    case "COVERAGE_REQ_DEFINED":
    case "COVERAGE_REQ_CHANGED": {
      const id = str(p, "requirementId");
      if (!id) return;
      const appliesToRaw = str(p, "appliesTo");
      const appliesTo: CoverageRequirement["appliesTo"] =
        appliesToRaw === "day" || appliesToRaw === "shift" || appliesToRaw === "role"
          ? appliesToRaw
          : (state.coverageReqs[id]?.appliesTo ?? "day");
      const twStart = p["timeWindow"] && typeof p["timeWindow"] === "object"
        ? str(p["timeWindow"] as Record<string, unknown>, "start")
        : null;
      const twEnd = p["timeWindow"] && typeof p["timeWindow"] === "object"
        ? str(p["timeWindow"] as Record<string, unknown>, "end")
        : null;
      const existing = state.coverageReqs[id];
      const req: CoverageRequirement = {
        id,
        appliesTo,
        timeWindow: twStart && twEnd ? { start: twStart, end: twEnd } : (existing?.timeWindow ?? null),
        minHeadcount: num(p, "minHeadcount") ?? existing?.minHeadcount ?? 0,
        minByRole: "minByRole" in p ? roleMap(p, "minByRole") : (existing?.minByRole ?? {}),
      };
      state.coverageReqs[id] = req;
      return;
    }
    case "COVERAGE_REQ_REMOVED": {
      const id = str(p, "requirementId");
      if (id) delete state.coverageReqs[id];
      return;
    }
    case "SWAP_REQUESTED":
      // A pending swap does not change assignments; it becomes a manager-queue signal (Phase 5/6).
      // No core-state mutation in Phase 1.
      return;
    default:
      // Forward-compatible: an unknown event type (from a later phase replayed by older code) is a
      // no-op, never a throw. Replay must survive vocabulary growth.
      return;
  }
}

/**
 * Replay the full event log into the current schedule state. Pure + deterministic: sorts a COPY by
 * (seq) and folds. Input order does not matter (we sort); the same set of events always yields the
 * same state.
 */
export function deriveState(events: ScheduleEvent[]): ScheduleState {
  const state: ScheduleState = {
    shifts: {},
    timeOff: {},
    availability: {},
    coverageReqs: {},
  };
  const ordered = [...events].sort((a, b) => a.seq - b.seq);
  for (const e of ordered) applyEvent(state, e);
  return state;
}
