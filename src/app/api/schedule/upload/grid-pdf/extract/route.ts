import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { decodeBase64 } from "@/lib/schedule/vaUpload";
import { extractStaffDateGridFromPdf, extractPdfPages, gridToCsv, docxCellsToCsv } from "@/lib/schedule/staffDatePdf";
import { pdfGridToCsv } from "@/lib/schedule/pdfIsoGrid";
import { parseCsvToGrid } from "@/lib/schedule/csvGrid";
import { xlsxToCsv } from "@/lib/schedule/staffDateXlsx";
import { parseDocxTableCells } from "@/lib/schedule/vaDocx";
import { normalizeCode } from "@/lib/schedule/gridParser";
import { EmptyExtractionError, unzipEntry } from "@/lib/documents/extractText";

/**
 * Schedule Management System — staff x date grid PDF extraction (the "frendz" layout).
 *
 * A staff x date shift-code file is a different layout than the VA "On Duty" grid, and — unlike VA — it
 * carries EXPLICIT dates, so it belongs on the CSV import path, not the target-week VA path. This route does
 * only the format-specific step -> CSV text, so the client drives the EXISTING /upload/{propose,preview,commit}
 * routes with that CSV (ONE downstream import path, not a parallel one). Two inputs:
 *   - .pdf: positional extraction (StaffDateGrid) — dates are RESOLVED (title month/year + day numbers), so the
 *     response carries headerDates and the client can skip straight to the code-map confirm.
 *   - .docx: a REAL Word table -> CSV directly (no positional guessing). Dates are raw LABELS, so headerDates
 *     is [] and the client runs the normal Analyze (LLM date-resolution + human confirm), same as pasted CSV.
 *
 * Manager-only. Read-only; the ~4.5MB base64 cap is the DoS guard (docx also rides the bomb-guarded unzipEntry).
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

  const isPdf = /\.pdf$/i.test(body.filename);
  const isDocx = /\.docx$/i.test(body.filename);
  const isXlsx = /\.xlsx$/i.test(body.filename);
  if (!isPdf && !isDocx && !isXlsx) {
    return NextResponse.json({ error: "Upload a .pdf, .docx or .xlsx schedule grid (or paste it as CSV)." }, { status: 415 });
  }
  const bytes = decodeBase64(body.fileBase64);
  if (!bytes) return NextResponse.json({ error: "Couldn't read the uploaded file." }, { status: 400 });

  try {
    if (isDocx || isXlsx) {
      // A real table (Word or Excel) → CSV directly. Dates are raw labels (headerDates: []), so the client
      // runs the normal Analyze step to resolve them — no positional guessing, no unverified inference.
      const csv = isDocx ? docxCellsToCsv(parseDocxTableCells(await unzipEntry(bytes, "word/document.xml"))) : await xlsxToCsv(bytes);
      if (!csv.trim()) {
        return NextResponse.json(
          { error: `No table was found in that .${isDocx ? "docx" : "xlsx"}. Is it a staff (rows) x dates (columns) grid?` },
          { status: 422 },
        );
      }
      return NextResponse.json({ csv, headerDates: [], staff: [], codes: [], warnings: [] });
    }

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
      // GENERIC fallback: the specific parsers (frendz layout / our ISO export) didn't recognize this PDF, but
      // it may still be a staff×date grid in a DIFFERENT layout (e.g. "AUG 16" date-label headers). Cluster its
      // positioned text into columns/rows → CSV, and let the normal Analyze flow (LLM date-resolution + confirm)
      // handle it, exactly like docx/xlsx. headerDates: [] → the client runs Analyze rather than pre-filling.
      // Instrument the fallback (diagnose-before-patching): capture WHY it didn't yield a grid so a real failing
      // file reveals its cause (no text at all → scanned image; text but no columns → a layout to tune).
      let pageCount = 0, itemCount = 0, csvLen = 0, dataRowCount = 0, headerFilled = 0;
      try {
        const pages = await extractPdfPages(bytes);
        pageCount = pages.length;
        itemCount = pages.reduce((n, p) => n + p.length, 0);
        const csv = pdfGridToCsv(pages);
        csvLen = csv.trim().length;
        const g = parseCsvToGrid(csv);
        const dataRows = g.rows.filter((r) => r.name.trim());
        dataRowCount = dataRows.length;
        headerFilled = g.headerCells.filter((h) => h.trim()).length;
        if (csvLen > 0 && dataRowCount >= 1 && headerFilled > 0) {
          const codes = new Set<string>();
          for (const row of dataRows) for (const cell of row.cells) { const c = cell.trim(); if (c) codes.add(normalizeCode(c)); }
          return NextResponse.json({
            csv,
            headerDates: [],
            staff: dataRows.map((r) => r.name.trim()),
            codes: [...codes].sort(),
            warnings: ["I read this file as a general staff-by-date table. Click Analyze to confirm the dates and shift codes before importing."],
          });
        }
      } catch (fe) {
        console.error("[schedule/upload/grid-pdf/extract] generic fallback threw:", fe instanceof Error ? fe.message : fe);
      }
      console.error(`[schedule/upload/grid-pdf/extract] fallback yielded no grid: pages=${pageCount} textItems=${itemCount} csvLen=${csvLen} dataRows=${dataRowCount} headerCells=${headerFilled}`);
      // Cause-specific, honest message (§3.4): a PDF with NO extractable text is almost always a scanned image /
      // photo — no text-based reader can help; the manager needs a text PDF or to paste CSV. Text-but-no-grid is
      // a layout we can tune. Either way, give an actionable path, not a dead "not found".
      return NextResponse.json(
        {
          error: itemCount === 0
            ? "I couldn't read any text in that PDF — it looks like a scanned image or a photo of a schedule. Save/export it as a real (text) PDF, or paste the grid into the CSV box above, and I can read it."
            : "I read the text in that PDF but couldn't line it up into a staff (rows) x dates (columns) grid. Paste the grid into the CSV box above to import it now — or send me the file and I'll tune the reader to its exact layout.",
        },
        { status: 422 },
      );
    }
    console.error("[schedule/upload/grid-pdf/extract] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Couldn't read that file." }, { status: 500 });
  }
}
