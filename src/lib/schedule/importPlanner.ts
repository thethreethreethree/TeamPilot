/**
 * Schedule Management System — import planner (Phase 5, S3 commit step; DETERMINISTIC).
 *
 * Turns a CONFIRMED upload preview into the exact set of roster rows + schedule events an import will create,
 * WITHOUT doing IO. The thin commit route applies this plan (create new staff → get ids → append
 * SHIFT_DEFINED + EMPLOYEE_ASSIGNED). Keeping the planning pure makes the whole "what will this import do"
 * question testable, and keeps id-generation/IO out of the logic.
 *
 * Rules: only "shift" entries produce shifts/assignments; "off"/"empty"/"unknown" produce nothing (an OFF is
 * the absence of a shift, not a time-off event). Shifts are de-duplicated by (date, start, end) so a whole
 * column of "6-3" becomes ONE shift with many assignments, not many identical shifts.
 */
import type { GridEntry } from "./gridParser";

export interface ImportPreview {
  staff: string[];
  entries: GridEntry[];
}

export interface PlannedShift {
  key: string; // stable "date|start|end" — the route maps it to a generated shiftId
  date: string;
  start: string;
  end: string;
}

export interface ImportPlan {
  /** Staff in the preview not already in the roster (created first, so assignments can reference them). */
  newStaff: string[];
  shifts: PlannedShift[];
  assignments: { shiftKey: string; staffName: string }[];
}

const shiftKey = (date: string, start: string, end: string) => `${date}|${start}|${end}`;

export function planImport(preview: ImportPreview, existingStaffNames: string[]): ImportPlan {
  const existing = new Set(existingStaffNames.map((n) => n.trim().toLowerCase()));
  const newStaff: string[] = [];
  const seenNew = new Set<string>();
  for (const name of preview.staff) {
    const key = name.trim().toLowerCase();
    if (!key || existing.has(key) || seenNew.has(key)) continue;
    seenNew.add(key);
    newStaff.push(name.trim());
  }

  const shiftByKey = new Map<string, PlannedShift>();
  const assignments: { shiftKey: string; staffName: string }[] = [];
  for (const e of preview.entries) {
    if (e.kind !== "shift" || !e.times) continue;
    const key = shiftKey(e.date, e.times.start, e.times.end);
    if (!shiftByKey.has(key)) shiftByKey.set(key, { key, date: e.date, start: e.times.start, end: e.times.end });
    assignments.push({ shiftKey: key, staffName: e.employeeName });
  }

  return { newStaff, shifts: [...shiftByKey.values()], assignments };
}
