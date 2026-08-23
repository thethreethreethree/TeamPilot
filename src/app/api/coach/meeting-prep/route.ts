import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { getOrCreateDraftMeetingPrep } from "@/lib/data/meetingPrep";

/**
 * POST /api/coach/meeting-prep — get-or-create a DRAFT Prep-up for the current facilitator (Team-Sync, founder
 * 2026-08-22). Returns an empty prep; the client then fills goal + topics (PATCH [id]) and uploads documents
 * ([id]/document). Owner-scoped: the prep is created_by the caller, company pinned to their company.
 *
 * REUSES the caller's most-recent TRULY-EMPTY draft instead of orphaning a new empty prep on every /prep visit
 * (audit D5). Client-transparent — it still receives an empty prep either way.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "meeting-prep-create", windowMs: 60_000, max: 30 });
  if (limited) return limited;

  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const companyId = (await getCurrentCompanyId()) ?? undefined;
  if (!companyId) return NextResponse.json({ error: "No company context." }, { status: 403 });

  const prep = await getOrCreateDraftMeetingPrep({ companyId });
  if (!prep) return NextResponse.json({ error: "Couldn't create the prep." }, { status: 500 });
  return NextResponse.json({ prep });
}
