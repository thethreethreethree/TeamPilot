/**
 * Schedule Management System — VA import orchestration (Phase 5; R-VA-3 glue).
 *
 * One helper both the VA preview + commit routes call, so the "bytes → dated import" path is defined ONCE
 * (the commit route re-runs it deterministically rather than trusting a client-supplied plan — the same
 * discipline as the CSV commit). Dispatches by file extension to the .docx (canonical) or .pdf extractor,
 * parses the grid, and resolves the recurring template to a dated ImportPreview for the target week.
 *
 * Format support is an explicit allowlist (A33): .docx / .pdf only. Anything else is an UnsupportedFormat.
 */
import { extensionOf, UnsupportedFormatError } from "@/lib/documents/extractText";
import { extractVaGridFromDocx } from "./vaDocx";
import { extractVaGridFromPdf } from "./vaPdf";
import { parseVaGrid } from "./vaGrid";
import { resolveVaToPreview, type ResolveOptions } from "./vaResolve";
import type { ImportPreview } from "./importPlanner";

export const VA_SUPPORTED_EXTENSIONS = ["docx", "pdf"] as const;

export interface VaImportResult {
  preview: ImportPreview;
  /** Time-block labels that could not be parsed (surfaced for confirmation — never silently dropped). */
  unparsedBlocks: string[];
}

/**
 * Extract a VA presence grid from a .docx/.pdf buffer and resolve it to a dated ImportPreview for the
 * target week. Throws UnsupportedFormatError for any other extension, or the extractor's EmptyExtraction
 * error when the file carries no readable schedule table.
 */
export async function extractAndResolveVa(
  bytes: Uint8Array,
  filename: string,
  opts: ResolveOptions,
): Promise<VaImportResult> {
  const ext = extensionOf(filename);
  let grid;
  if (ext === "docx") grid = await extractVaGridFromDocx(bytes);
  else if (ext === "pdf") grid = await extractVaGridFromPdf(bytes);
  else {
    throw new UnsupportedFormatError(
      ext,
      `.${ext || "?"} isn't a supported schedule file. Upload a ${VA_SUPPORTED_EXTENSIONS.join(" or ")}.`,
    );
  }
  const parse = parseVaGrid(grid);
  const preview = resolveVaToPreview(parse, opts);
  return { preview, unparsedBlocks: parse.unparsedBlocks };
}
