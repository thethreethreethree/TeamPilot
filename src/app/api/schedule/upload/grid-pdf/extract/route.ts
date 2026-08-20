import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { decodeBase64 } from "@/lib/schedule/vaUpload";
import { extractPdfPages, gridToCsv, docxCellsToCsv, pdfItemsToStaffDateGrid } from "@/lib/schedule/staffDatePdf";
import { pdfGridToCsv, isIsoHeaderGrid, isoGridFromItems } from "@/lib/schedule/pdfIsoGrid";
import { parseCsvToGrid } from "@/lib/schedule/csvGrid";
import { xlsxToCsv } from "@/lib/schedule/staffDateXlsx";
import { parseDocxTableCells } from "@/lib/schedule/vaDocx";
import { normalizeCode } from "@/lib/schedule/gridParser";
import { unzipEntry } from "@/lib/documents/extractText";

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

    // PDF: extract text ONCE (unpdf), then run the specific parser AND the generic fallback on the SAME pages —
    // never call unpdf twice. unpdf's loopback worker can break on a 2nd call in the same process (the real
    // HK.pdf / HUB SCHED files throw "Cannot transfer object" on a repeat call), so a single extraction shared by
    // both readers is the robust shape — and it's also cheaper. The specific parser is pure over pages; if it
    // doesn't yield a grid, the generic column/row clusterer does, feeding the same Analyze-confirm flow.
    let pages: Awaited<ReturnType<typeof extractPdfPages>>;
    try {
      pages = await extractPdfPages(bytes);
    } catch (pe) {
      console.error("[schedule/upload/grid-pdf/extract] pdf text extraction failed:", pe instanceof Error ? pe.message : pe);
      return NextResponse.json(
        { error: "I couldn't read that PDF. If it's a scanned image or a photo, save it as a text PDF or paste the grid into the CSV box above." },
        { status: 422 },
      );
    }

    // Specific parser (PURE over pages): our own ISO export, else the frendz day-number/weekday layout. Wrapped
    // so a parse throw doesn't skip the fallback — the fallback reads layouts the specific parser can't.
    try {
      const grid = isIsoHeaderGrid(pages) ? isoGridFromItems(pages) : pdfItemsToStaffDateGrid(pages);
      if (grid.staff.length > 0 && grid.headerDates.length > 0) {
        const codes = new Set<string>();
        for (const row of grid.rows) for (const cell of row.cells) { const c = cell.trim(); if (c) codes.add(normalizeCode(c)); }
        return NextResponse.json({
          csv: gridToCsv(grid),
          headerDates: grid.headerDates,
          staff: grid.staff,
          codes: [...codes].sort(),
          warnings: grid.warnings, // extraction-integrity concerns for the manager to check against the preview
        });
      }
    } catch (spe) {
      console.error("[schedule/upload/grid-pdf/extract] specific parser failed; using generic fallback:", spe instanceof Error ? spe.message : spe);
    }

    // GENERIC fallback on the SAME pages: cluster positioned text into columns/rows → CSV → the normal Analyze
    // flow (LLM date-resolution + human confirm). headerDates: [] → the client runs Analyze rather than pre-fill.
    const itemCount = pages.reduce((n, p) => n + p.length, 0);
    const csv = pdfGridToCsv(pages);
    const g = parseCsvToGrid(csv);
    const dataRows = g.rows.filter((r) => r.name.trim());
    const headerFilled = g.headerCells.filter((h) => h.trim()).length;
    if (csv.trim().length > 0 && dataRows.length >= 1 && headerFilled > 0) {
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
    // Cause-specific, honest message (§3.4): NO extractable text → almost always a scanned image (no text reader
    // helps); text-but-no-grid → a layout to tune. Either way, an actionable path, not a dead "not found".
    console.error(`[schedule/upload/grid-pdf/extract] no grid: textItems=${itemCount} csvLen=${csv.trim().length} dataRows=${dataRows.length} headerCells=${headerFilled}`);
    return NextResponse.json(
      {
        error: itemCount === 0
          ? "I couldn't read any text in that PDF — it looks like a scanned image or a photo of a schedule. Save/export it as a real (text) PDF, or paste the grid into the CSV box above, and I can read it."
          : "I read the text in that PDF but couldn't line it up into a staff (rows) x dates (columns) grid. Paste the grid into the CSV box above to import it now — or send me the file and I'll tune the reader to its exact layout.",
      },
      { status: 422 },
    );
  } catch (e) {
    console.error("[schedule/upload/grid-pdf/extract] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Couldn't read that file." }, { status: 500 });
  }
}
