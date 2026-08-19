import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { VaUploadBody, extractVaOrError } from "@/lib/schedule/vaUpload";

/**
 * Schedule Management System — VA presence-grid upload PREVIEW (Phase 5; R-VA-3).
 *
 * POST a .docx/.pdf VA schedule (base64) + a target week; get back the dated import it WOULD create — staff,
 * per-day entries, and any time-block labels that couldn't be parsed (surfaced for confirmation, never a
 * silent drop). Nothing is persisted; the commit route re-extracts deterministically and writes.
 *
 * Hardening (shared with commit via vaUpload): auth-FIRST + manager-only, base64 size cap, format allowlist
 * + decompression-bomb guard, maxDuration, and CWE-209 typed→safe errors.
 */
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "schedule-upload-va-preview", windowMs: 60_000, max: 20 });
  if (limited) return limited;

  const body = await readBody(req, VaUploadBody);
  if (body instanceof NextResponse) return body;

  // Auth FIRST — never parse an untrusted upload for an unauthenticated caller.
  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: "Only a manager can import a schedule." }, { status: 403 });

  const res = await extractVaOrError(body, "schedule/upload/va/preview");
  if (res instanceof NextResponse) return res;

  const { preview, unparsedBlocks } = res;
  return NextResponse.json({
    staff: preview.staff,
    entries: preview.entries,
    entryCount: preview.entries.length,
    unparsedBlocks,
    readyToCommit: unparsedBlocks.length === 0 && preview.entries.length > 0,
  });
}
