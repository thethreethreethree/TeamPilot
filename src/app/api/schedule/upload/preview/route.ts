import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { parseCsvToGrid } from "@/lib/schedule/csvGrid";
import { parseScheduleGrid } from "@/lib/schedule/gridParser";

/**
 * Schedule Management System — Phase 5 file-upload PREVIEW (S3, parse-then-confirm).
 *
 * POST a CSV plus the resolved header dates + a shift-code map (both proposed by the LLM and CONFIRMED by
 * the manager, per the founder's parse-then-confirm pick), and get back the structured preview of what an
 * import WOULD create — staff, per-day entries, and any UNKNOWN codes that still need mapping. NOTHING is
 * persisted here; the manager reviews this preview, then a separate commit step writes the roster + events.
 *
 * Manager-only (a roster import is a manager action). CSV is text-capped (a cheap DoS guard); the parse is
 * the deterministic core (csvGrid + gridParser), so this route is pure plumbing over tested logic.
 */

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const Body = z.object({
  csv: z.string().min(1).max(1_000_000), // ~1MB text cap
  headerDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1).max(400),
  codeMap: z.record(z.string().min(1).max(40), z.union([z.object({ start: hhmm, end: hhmm }), z.literal("off")])).default({}),
  headerRowIndex: z.number().int().nonnegative().max(50).optional(),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "schedule-upload-preview", windowMs: 60_000, max: 30 });
  if (limited) return limited;

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: "Only a manager can import a schedule." }, { status: 403 });

  const grid = parseCsvToGrid(body.csv, { headerRowIndex: body.headerRowIndex });
  const parsed = parseScheduleGrid({ headerDates: body.headerDates, rows: grid.rows, codeMap: body.codeMap });

  // The preview: exactly what a commit would create, plus the codes still needing a mapping (so the manager
  // fixes the map before committing — never a silent drop or a guessed shift).
  return NextResponse.json({
    staff: parsed.staff,
    entryCount: parsed.entries.length,
    shifts: parsed.entries.filter((e) => e.kind === "shift").length,
    off: parsed.entries.filter((e) => e.kind === "off").length,
    unknownCodes: parsed.unknownCodes,
    entries: parsed.entries,
    readyToCommit: parsed.unknownCodes.length === 0,
  });
}
