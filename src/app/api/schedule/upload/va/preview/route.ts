import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { extractAndResolveVa } from "@/lib/schedule/vaImport";
import { UnsupportedFormatError, EmptyExtractionError, DecompressionLimitError } from "@/lib/documents/extractText";

/**
 * Schedule Management System — VA presence-grid upload PREVIEW (Phase 5; R-VA-3).
 *
 * POST a .docx/.pdf VA schedule (base64) + a target week; get back the dated import it WOULD create — staff,
 * per-day entries, and any time-block labels that couldn't be parsed (surfaced for confirmation, never a
 * silent drop). Nothing is persisted; the commit route re-extracts deterministically and writes.
 *
 * Hardening stack: auth-FIRST + manager-only, base64 size cap (cheap DoS guard), format allowlist +
 * decompression-bomb guard (in the extractor), maxDuration, and CWE-209 generic errors (no raw exception
 * leak). The parse/resolve core is the tested deterministic logic; this route is plumbing over it.
 */
export const maxDuration = 30;

const Body = z.object({
  fileBase64: z.string().min(1).max(6_000_000), // ~4.5MB file cap (under the Vercel body limit); schedules are tiny
  filename: z.string().min(1).max(255),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weekdayOffsets: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "schedule-upload-va-preview", windowMs: 60_000, max: 20 });
  if (limited) return limited;

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  // Auth FIRST — never parse an untrusted upload for an unauthenticated caller.
  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: "Only a manager can import a schedule." }, { status: 403 });

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(Buffer.from(body.fileBase64, "base64"));
  } catch {
    return NextResponse.json({ error: "Couldn't read the uploaded file." }, { status: 400 });
  }

  try {
    const { preview, unparsedBlocks } = await extractAndResolveVa(bytes, body.filename, {
      weekStart: body.weekStart,
      weekdayOffsets: body.weekdayOffsets,
    });
    return NextResponse.json({
      staff: preview.staff,
      entries: preview.entries,
      entryCount: preview.entries.length,
      unparsedBlocks,
      readyToCommit: unparsedBlocks.length === 0 && preview.entries.length > 0,
    });
  } catch (e) {
    // Honest, specific-but-safe errors (CWE-209: never leak the raw exception to the client).
    if (e instanceof UnsupportedFormatError) return NextResponse.json({ error: e.message }, { status: 415 });
    if (e instanceof EmptyExtractionError)
      return NextResponse.json({ error: "No schedule table was found in that file." }, { status: 422 });
    if (e instanceof DecompressionLimitError)
      return NextResponse.json({ error: "That file expands to too much content to process safely." }, { status: 413 });
    console.error("[schedule/upload/va/preview] extraction failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Couldn't read that schedule file." }, { status: 500 });
  }
}
