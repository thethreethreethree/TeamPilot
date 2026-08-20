import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { parseCsvToGrid } from "@/lib/schedule/csvGrid";
import { normalizeCode } from "@/lib/schedule/gridParser";
import { proposeImportMapping } from "@/lib/schedule/ai";
import { resolveGridDates } from "@/lib/schedule/importDates";
import { getScheduleSettings, todayInTz } from "@/lib/schedule/settings";
import { createClient } from "@/lib/supabase/server";

/**
 * Schedule Management System — Phase 5 upload PROPOSE (S3, propose-then-confirm step 1).
 *
 * POST a CSV; the server extracts the header labels + the distinct shift codes, then asks the LLM to PROPOSE
 * the ISO date per column + a code→meaning map — for the manager to CONFIRM/edit before preview + commit. The
 * proposal is advisory: nothing is applied, unknown codes are left for the human to map, a code the LLM can't
 * read is omitted (never guessed). Manager-only; CSV text-capped.
 */
export const maxDuration = 60;

const Body = z.object({
  csv: z.string().min(1).max(1_000_000),
  contextHint: z.string().max(300).optional(),
  headerRowIndex: z.number().int().nonnegative().max(50).optional(),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "schedule-upload-propose", windowMs: 60_000, max: 20 });
  if (limited) return limited;

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: "Only a manager can import a schedule." }, { status: 403 });

  const grid = parseCsvToGrid(body.csv, { headerRowIndex: body.headerRowIndex });

  // Distinct non-empty codes across the cells (normalized), for the LLM to interpret.
  const codes = new Set<string>();
  for (const row of grid.rows) {
    if (!row.name.trim()) continue; // skip separator rows
    for (const cell of row.cells) {
      const c = cell.trim();
      if (c) codes.add(normalizeCode(c));
    }
  }

  // Resolve dates DETERMINISTICALLY first (month from the file/context + year nearest today) — the LLM refuses
  // to guess a year from bare day numbers, which left the paste→Analyze path with blank dates even when the
  // month is right there in the file. This is the same resolver the file-upload route uses.
  let today: string;
  try {
    const sb = await createClient();
    today = todayInTz((await getScheduleSettings(sb, ctx.companyId)).timezone);
  } catch {
    today = new Date().toISOString().slice(0, 10);
  }
  const monthText = `${grid.headerCells.join(" ")} ${body.contextHint ?? ""} ${body.csv.split("\n")[0] ?? ""}`;
  const { dates: detDates, anyResolved } = resolveGridDates(grid.headerCells, monthText, today);

  try {
    const proposal = await proposeImportMapping({
      headerCells: grid.headerCells,
      codes: [...codes],
      contextHint: body.contextHint,
    });
    // Prefer the deterministic date for each column; fall back to the LLM's only where the resolver couldn't.
    const headerDates = grid.headerCells.map((_, i) => detDates[i] || proposal.headerDates?.[i] || "");
    const notes = anyResolved
      ? "I filled in the dates from the month and day columns. Check the dates and shift-code times, then Preview."
      : proposal.notes;
    return NextResponse.json({ headerCells: grid.headerCells, codes: [...codes], ...proposal, headerDates, notes });
  } catch (e) {
    // The LLM (codes) failed, but deterministic dates may still be usable — return them so the manager can map
    // codes by hand rather than starting from nothing.
    if (anyResolved) {
      return NextResponse.json({ headerCells: grid.headerCells, codes: [...codes], headerDates: detDates, codeMap: {}, notes: "I filled in the dates from the month and day columns. Map the shift codes below, then Preview." });
    }
    // Fail loud (never a false-empty proposal the manager might trust): a real 502, retry available.
    console.error("[schedule/upload/propose] mapping proposal failed:", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "Couldn't propose a mapping right now — you can map the dates and codes by hand, or try again." },
      { status: 502 },
    );
  }
}
