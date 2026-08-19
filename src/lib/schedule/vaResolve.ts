/**
 * Schedule Management System — resolve a VA recurring-weekday template to a dated import (Phase 5; R-VA-3).
 *
 * The VA grid is a recurring "Weekday Schedule (Mon–Fri)" with NO dates — each staff member's coalesced
 * shifts repeat on every weekday. To import it, a manager picks a TARGET WEEK; this resolves the template
 * into concrete dated shifts (Mon–Fri of that week) as an `ImportPreview` — the SAME structure the CSV
 * import produces. So the VA path converges on the existing `planImport → apply_schedule_import` commit
 * path (composition, not a second writer), rather than a parallel pipeline.
 *
 * An overnight shift (e.g. 23:00–03:00) is attributed to its START date, consistent with how the projector
 * + `shiftDurationHours` treat `shift.date` (the start day). Pure + UTC-deterministic (no local-tz parsing).
 */
import { weekStartOf, addDaysIso } from "./constraints";
import type { VaParseResult } from "./vaGrid";
import type { ImportPreview } from "./importPlanner";
import type { GridEntry } from "./gridParser";

// addDaysIso now lives in constraints.ts (co-located with the other date helpers); re-exported so existing
// importers of it from this module keep working.
export { addDaysIso } from "./constraints";

export interface ResolveOptions {
  /** Any date within the target week — normalized to that week's Monday. */
  weekStart: string;
  /** Day offsets from Monday to apply the template to. Default Mon–Fri ([0,1,2,3,4]) per the VA grid's
   *  "Weekday Schedule (Mon–Fri)" heading. Pass [0..6] for a 7-day roster. */
  weekdayOffsets?: number[];
}

/**
 * Resolve a parsed VA template to a dated `ImportPreview` for the target week. Every staff member's
 * coalesced shifts are emitted on each selected weekday. Returns an empty preview (but with the staff list)
 * if the target week is malformed, rather than throwing — the caller surfaces "pick a valid week".
 */
export function resolveVaToPreview(parse: VaParseResult, opts: ResolveOptions): ImportPreview {
  const offsets = opts.weekdayOffsets ?? [0, 1, 2, 3, 4];
  const monday = weekStartOf(opts.weekStart);
  const staff = Object.keys(parse.shiftsByStaff);
  const entries: GridEntry[] = [];
  if (monday) {
    for (const name of staff) {
      const shifts = parse.shiftsByStaff[name] ?? [];
      if (shifts.length === 0) continue;
      for (const offset of offsets) {
        const date = addDaysIso(monday, offset);
        if (!date) continue;
        for (const s of shifts) {
          entries.push({
            employeeName: name,
            date,
            rawCode: `${s.start}-${s.end}`,
            kind: "shift",
            times: { start: s.start, end: s.end },
          });
        }
      }
    }
  }
  return { staff, entries };
}
