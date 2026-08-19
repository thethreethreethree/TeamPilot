/**
 * Schedule Management System — VA presence-grid parser (Phase 5 follow-up; DETERMINISTIC, pure).
 *
 * The founder's real sample files (VA_Weekly_Schedule.docx / VA_Weekly_Color_Grid.pdf) are a DIFFERENT
 * shape from the staff × date shift-code grid `gridParser.ts` handles. They are a **coverage presence
 * grid**: rows are time-blocks ("5 AM - 8 AM", "10 AM - 12 PM", "11 PM - 2 AM"), columns are staff names,
 * and a cell is "On Duty" (present) or blank. It is a recurring WEEKDAY template (Mon–Fri), not dated.
 *
 * This module is the file-format-INDEPENDENT core: it turns an already-extracted grid into, per staff, the
 * set of SHIFTS they work — by coalescing their contiguous On-Duty blocks (Alex On-Duty 10-12PM AND 12-1PM
 * is ONE shift 10:00–13:00, not two). The .docx/.pdf extractors (separate) produce the grid this consumes;
 * resolving the weekday template to concrete dates for a target week is a separate step (resolveVaWeek).
 *
 * Why the split: the parse is the hard, testable part and must not depend on how the bytes were read. See
 * `docs/audits/2026-08-19-schedule-import-format-gap.md` for the finding + the founder's "full" decision.
 */

/** A time range in 24h "HH:mm". `end` may be numerically <= `start` when the block crosses midnight
 *  (e.g. 23:00→02:00); duration math (`shiftDurationHours`) already treats that as +24h. */
export interface TimeRange {
  start: string;
  end: string;
}

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

/** 12h clock → minutes since midnight. hour is 1..12, meridiem "AM"|"PM". 12 AM = 00:00, 12 PM = 12:00. */
function to24(hour: number, minute: number, meridiem: "AM" | "PM"): number {
  let h = hour % 12; // 12 → 0
  if (meridiem === "PM") h += 12;
  return h * 60 + minute;
}

const mins2hhmm = (m: number) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;

/**
 * Parse a time-block label into a TimeRange. Handles the two notations seen in the founder's files:
 *   - explicit both-sides (.docx):  "5 AM - 8 AM", "10 AM - 12 PM", "11 PM - 2 AM"
 *   - shorthand end-only-meridiem (.pdf): "5-8 AM", "10-12 PM", "11 PM-2 AM"
 * When only the END carries a meridiem, the START inherits it UNLESS start > end numerically, which means
 * the range straddles the AM/PM boundary (e.g. "10-12 PM" = 10 AM → 12 PM) — inferred as the earlier
 * meridiem for the start. Minutes are supported ("5:30 AM"). Returns null for anything unparseable, never
 * throws (a malformed row is surfaced upstream, never silently mis-timed).
 *
 * NOTE the shorthand is genuinely ambiguous ("10-12 PM" could be 10 AM–12 PM or 10 PM–12 AM); we resolve
 * it the way the founder's paired .docx disambiguates it, and the .docx (explicit) is the canonical source.
 */
export function parseTimeBlock(label: string): TimeRange | null {
  const norm = label.replace(/–|—/g, "-").replace(/\s+/g, " ").trim(); // en/em dash → hyphen
  // side = number, optional :minutes, optional AM/PM
  const side = "(\\d{1,2})(?::(\\d{2}))?\\s*(AM|PM)?";
  const m = new RegExp(`^${side}\\s*-\\s*${side}$`, "i").exec(norm);
  if (!m) return null;
  const [, sh, sm, sMer, eh, em, eMer] = m;
  const startHour = Number(sh);
  const endHour = Number(eh);
  if (startHour < 1 || startHour > 12 || endHour < 1 || endHour > 12) return null;
  const endMer = (eMer ?? sMer)?.toUpperCase() as "AM" | "PM" | undefined;
  if (!endMer) return null; // no meridiem anywhere → cannot resolve
  const endMin = to24(endHour, Number(em ?? 0), endMer);
  let startMer = (sMer ?? endMer).toUpperCase() as "AM" | "PM";
  // Shorthand ("X-Y PM" with no start meridiem): inherit the end's, but if inheriting makes the block
  // non-forward within the day (start >= end), the start is in the OTHER half. This resolves "10-12 PM"
  // → 10 AM–12 PM, and "11-2 AM" → 11 PM–2 AM (cross-midnight). An EXPLICIT start meridiem is trusted
  // as-is (so a real cross-midnight block like "11 PM - 2 AM" is preserved, not flipped).
  if (!sMer && to24(startHour, Number(sm ?? 0), startMer) >= endMin) {
    startMer = startMer === "PM" ? "AM" : "PM";
  }
  const startMin = to24(startHour, Number(sm ?? 0), startMer);
  return { start: mins2hhmm(startMin), end: mins2hhmm(endMin) };
}

/**
 * Coalesce a staff member's On-Duty time-blocks into shifts: blocks that TOUCH (one ends exactly where the
 * next begins) or overlap merge into a single continuous shift; a gap splits them.
 *
 * IMPORTANT: `ranges` MUST be in the grid's cycle/row order (the VA grid's rows run one daily cycle, e.g.
 * 5 AM through the following 5 AM). We do NOT sort by absolute clock, because a block like "2-3 AM" is the
 * TAIL of the overnight run that began at "11 PM", not the start of the day — sorting by clock time would
 * wrongly split "11 PM-2 AM" from "2-3 AM". Instead we unroll the cycle into a monotonic timeline: each
 * time a block's start clock-time drops below the previous block's, we advance a day so the run stays
 * contiguous. `parseVaGrid` feeds blocks in row order, satisfying this precondition.
 */
export function coalesceRanges(ranges: TimeRange[]): TimeRange[] {
  const toMin = (t: string): number | null => {
    const x = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(t);
    return x ? Number(x[1]) * 60 + Number(x[2]) : null;
  };
  const DAY = 24 * 60;
  const out: TimeRange[] = [];
  let cur: { cs: number; ce: number; start: string; end: string } | null = null;
  let dayOffset = 0;
  let prevStartClock = -1;
  for (const r of ranges) {
    const s = toMin(r.start);
    const e0 = toMin(r.end);
    if (s === null || e0 === null) continue;
    if (prevStartClock >= 0 && s < prevStartClock) dayOffset += 1; // clock wrapped past midnight → next cycle-day
    prevStartClock = s;
    const cs = s + dayOffset * DAY;
    let ce = e0 + dayOffset * DAY;
    if (ce <= cs) ce += DAY; // the block itself crosses midnight
    if (cur && cs <= cur.ce) {
      if (ce > cur.ce) {
        cur.ce = ce;
        cur.end = r.end;
      }
    } else {
      if (cur) out.push({ start: cur.start, end: cur.end });
      cur = { cs, ce, start: r.start, end: r.end };
    }
  }
  if (cur) out.push({ start: cur.start, end: cur.end });
  return out;
}

/** The extracted grid, format-independent: one entry per time-block row, each carrying which staff are
 *  "On Duty" in that block. `staff` is the full ordered column list (so a staff with zero shifts is known). */
export interface VaGrid {
  staff: string[];
  rows: { block: string; onDuty: string[] }[];
}

export interface VaParseResult {
  /** Per staff name (trimmed), their coalesced shifts as a recurring weekday pattern. Empty array = present
   *  in the roster columns but never On-Duty. */
  shiftsByStaff: Record<string, TimeRange[]>;
  /** Block labels that could not be parsed — surfaced for confirmation, NEVER silently dropped (3.4). */
  unparsedBlocks: string[];
}

/**
 * Turn a VA presence grid into per-staff coalesced shifts. Pure. Unparseable block labels are collected in
 * `unparsedBlocks` (their On-Duty marks are excluded rather than mis-timed). Staff names are trimmed; a
 * blank staff column is ignored.
 */
export function parseVaGrid(grid: VaGrid): VaParseResult {
  const staff = grid.staff.map((s) => s.trim()).filter((s) => s.length > 0);
  const byStaff: Record<string, TimeRange[]> = {};
  for (const s of staff) byStaff[s] = [];
  const unparsed: string[] = [];

  for (const row of grid.rows) {
    const range = parseTimeBlock(row.block);
    if (!range) {
      if (row.onDuty.some((n) => staff.includes(n.trim()))) unparsed.push(row.block);
      continue;
    }
    for (const nameRaw of row.onDuty) {
      const name = nameRaw.trim();
      if (byStaff[name]) byStaff[name].push(range);
    }
  }

  const shiftsByStaff: Record<string, TimeRange[]> = {};
  for (const s of staff) shiftsByStaff[s] = coalesceRanges(byStaff[s] ?? []);
  return { shiftsByStaff, unparsedBlocks: [...new Set(unparsed)] };
}
