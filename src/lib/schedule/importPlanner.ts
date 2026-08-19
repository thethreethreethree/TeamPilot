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

/**
 * The ids of existing shifts a re-import should SUPERSEDE — every current shift whose date falls within the
 * imported date SPAN (min..max of the planned shifts' dates). This is the "replace-the-week" semantic
 * (founder decision 2026-08-19): importing a week replaces that week's shifts, so a re-uploaded correction
 * doesn't stack duplicates on top of the originals.
 *
 * Span (not exact-date-set) is deliberate: a corrected week that drops a mid-week shift must clear the old
 * one, so a date inside the span with no new shift is still superseded. Returns [] when the import has no
 * shifts (no span to bound) — which also makes a FIRST import (empty schedule) a clean no-op.
 */
export function supersededShiftIds(
  existingShifts: { id: string; date: string }[],
  plannedShifts: { date: string }[],
): string[] {
  const span = dateSpan(plannedShifts);
  if (!span) return [];
  return existingShifts.filter((s) => s.date >= span.from && s.date <= span.to).map((s) => s.id);
}

/**
 * The [min, max] date span of a set of dated items (YYYY-MM-DD), or null if empty. The single source of the
 * "replace-the-week" range — used both to pick the superseded shifts (above) and to SHOW the manager the exact
 * date range a re-import will replace (so a typo'd import date, which widens the span, is obvious in the
 * preview rather than a silent large delete).
 */
export function dateSpan(items: { date: string }[]): { from: string; to: string } | null {
  const first = items[0];
  if (!first) return null;
  let from = first.date;
  let to = first.date;
  for (const s of items) {
    if (s.date < from) from = s.date;
    if (s.date > to) to = s.date;
  }
  return { from, to };
}
