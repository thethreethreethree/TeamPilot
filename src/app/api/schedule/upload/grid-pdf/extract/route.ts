import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { decodeBase64 } from "@/lib/schedule/vaUpload";
import { extractStaffDateGridFromPdf, gridToCsv } from "@/lib/schedule/staffDatePdf";
import { normalizeCode } from "@/lib/schedule/gridParser";
import { EmptyExtractionError } from "@/lib/documents/extractText";

/**
 * Schedule Management System — staff x date grid PDF extraction (the "frendz" layout).
 *
 * A staff x date shift-code PDF is a different layout than the VA "On Duty" grid, and — unlike VA — it carries
 * EXPLICIT dates, so it belongs on the CSV import path (dates resolved, codes human-confirmed), not the
 * target-week VA path. This route does only the format-specific step: PDF -> positioned extraction ->
 * StaffDateGrid -> CSV text + the distinct codes. The client then drives the EXISTING /upload/{preview,commit}
 * routes with that CSV, so there is ONE downstream import path, not a parallel one.
 *
 * Manager-only. Read-only (nothing is written); the ~4.5MB base64 cap is the DoS guard (a schedule PDF is tiny).
 */
export const maxDuration = 60;

const Body = z.object({
  fileBase64: z.string().min(1).max(6_000_000), // ~4.5MB, under the Vercel body limit
  filename: z.string().min(1).max(255),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "schedule-grid-pdf-extract", windowMs: 60_000, max: 20 });
  if (limited) return limited;

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: "Only a manager can import a schedule." }, { status: 403 });

  if (!/\.pdf$/i.test(body.filename)) {
    return NextResponse.json({ error: "Upload a .pdf schedule grid (or use the CSV grid tab)." }, { status: 415 });
  }
  const bytes = decodeBase64(body.fileBase64);
  if (!bytes) return NextResponse.json({ error: "Couldn't read the uploaded file." }, { status: 400 });

  try {
    const grid = await extractStaffDateGridFromPdf(bytes);
    const codes = new Set<string>();
    for (const row of grid.rows) {
      for (const cell of row.cells) {
        const c = cell.trim();
        if (c) codes.add(normalizeCode(c));
      }
    }
    return NextResponse.json({
      csv: gridToCsv(grid),
      headerDates: grid.headerDates,
      staff: grid.staff,
      codes: [...codes].sort(),
      warnings: grid.warnings, // extraction-integrity concerns for the manager to check against the preview
    });
  } catch (e) {
    if (e instanceof EmptyExtractionError) {
      return NextResponse.json(
        { error: "No staff-by-date schedule grid was found in that PDF. Is it a staff (rows) x dates (columns) grid?" },
        { status: 422 },
      );
    }
    console.error("[schedule/upload/grid-pdf/extract] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Couldn't read that PDF." }, { status: 500 });
  }
}
