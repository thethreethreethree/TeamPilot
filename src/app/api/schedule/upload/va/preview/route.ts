import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { VaUploadBody, extractVaOrError } from "@/lib/schedule/vaUpload";
import { supersededShiftIds } from "@/lib/schedule/importPlanner";
import { readExistingShifts } from "@/lib/schedule/commitImport";

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

  // Replace-the-week honesty (§3.4): how many existing shifts this import would supersede in its date span —
  // same supersededShiftIds the commit uses. Non-blocking (a read failure must not break the preview).
  const shiftEntries = preview.entries.filter((e) => e.kind === "shift");
  let willReplace = 0;
  try {
    const sb = await createClient();
    willReplace = supersededShiftIds(await readExistingShifts(sb, ctx.companyId), shiftEntries).length;
  } catch (e) {
    console.error("[schedule/upload/va/preview] supersede count failed (non-blocking):", e instanceof Error ? e.message : e);
  }

  return NextResponse.json({
    staff: preview.staff,
    entries: preview.entries,
    entryCount: preview.entries.length,
    unparsedBlocks,
    willReplace,
    readyToCommit: unparsedBlocks.length === 0 && preview.entries.length > 0,
  });
}
