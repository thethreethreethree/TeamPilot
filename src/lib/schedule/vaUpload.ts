/**
 * Schedule Management System — shared plumbing for the VA upload routes (preview + commit).
 *
 * Both routes validate the SAME body, base64-decode the file, and map the extractor's typed failures to the
 * SAME HTTP responses. Factoring that here keeps the two routes to their DIFFERENCES (preview returns the
 * preview; commit reads the roster + applies) and means the request contract + error mapping can't drift
 * between them.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { extractAndResolveVa, type VaImportResult } from "./vaImport";
import { MAX_UPLOAD_BASE64_CHARS } from "./uploadLimits";
import { UnsupportedFormatError, EmptyExtractionError, DecompressionLimitError } from "@/lib/documents/extractText";

/** The upload body shared by both VA routes: the file (base64), its name, the target week, optional weekdays. */
export const VaUploadBody = z.object({
  // The base64 body cap (shared with the client pre-check + grid-pdf route). The old 6 MB cap was a lie — a 6 MB
  // base64 body exceeds Vercel's ~4.5 MB request limit and never reaches this handler (opaque platform 413).
  fileBase64: z.string().min(1).max(MAX_UPLOAD_BASE64_CHARS),
  filename: z.string().min(1).max(255),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weekdayOffsets: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
});
export type VaUploadBody = z.infer<typeof VaUploadBody>;

/** Decode a base64 file body to bytes, or null if it isn't valid base64. */
export function decodeBase64(b64: string): Uint8Array | null {
  try {
    return new Uint8Array(Buffer.from(b64, "base64"));
  } catch {
    return null;
  }
}

/**
 * Extract + resolve a VA upload, mapping the extractor's typed failures to safe HTTP responses (CWE-209 —
 * never leak the raw exception). Returns the VaImportResult on success, or a NextResponse the caller returns
 * as-is. `label` names the route in the server log for the generic 500 path.
 */
export async function extractVaOrError(
  body: VaUploadBody,
  label: string,
): Promise<VaImportResult | NextResponse> {
  const bytes = decodeBase64(body.fileBase64);
  if (!bytes) return NextResponse.json({ error: "Couldn't read the uploaded file." }, { status: 400 });
  try {
    return await extractAndResolveVa(bytes, body.filename, {
      weekStart: body.weekStart,
      weekdayOffsets: body.weekdayOffsets,
    });
  } catch (e) {
    if (e instanceof UnsupportedFormatError) return NextResponse.json({ error: e.message }, { status: 415 });
    if (e instanceof EmptyExtractionError)
      return NextResponse.json(
        {
          error:
            "No 'On Duty' time-block grid was found. If your schedule is a staff-by-date grid (names down the side, dates across the top), use the 'CSV grid' tab and upload the PDF there.",
        },
        { status: 422 },
      );
    if (e instanceof DecompressionLimitError)
      return NextResponse.json({ error: "That file expands to too much content to process safely." }, { status: 413 });
    console.error(`[${label}] extraction failed:`, e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Couldn't read that schedule file." }, { status: 500 });
  }
}
