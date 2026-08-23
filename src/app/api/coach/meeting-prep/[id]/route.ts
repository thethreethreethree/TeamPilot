import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { getMeetingPrep, updateMeetingPrep, listPrepDocuments } from "@/lib/data/meetingPrep";

/**
 * GET  /api/coach/meeting-prep/[id] — the prep (goal + topics) + its documents. Owner-scoped via RLS (a
 *      non-owner gets null → 404).
 * PATCH /api/coach/meeting-prep/[id] — update the goal and/or the must-discuss topics.
 */

const TopicSchema = z.object({
  id: z.string().min(1).max(64),
  text: z.string().min(1).max(500),
  covered: z.boolean().default(false),
});
const PatchBody = z.object({
  goal: z.string().max(4000).optional(),
  topics: z.array(TopicSchema).max(100).optional(),
});

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  // getMeetingPrep/listPrepDocuments THROW on a genuine DB error (not a false 404) — a transient read failure is a
  // 500 "try again", not "your prep is gone" (audit: error-as-no-data). null is still a real not-found → 404.
  try {
    const prep = await getMeetingPrep(id);
    if (!prep) return NextResponse.json({ error: "Prep not found or not accessible." }, { status: 404 });
    const documents = await listPrepDocuments(id);
    return NextResponse.json({ prep, documents });
  } catch (e) {
    console.error(`[meeting-prep GET] read failed id=${id}: ${e instanceof Error ? e.message : e}`);
    return NextResponse.json({ error: "Couldn't load the prep right now — please try again." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "meeting-prep-update", windowMs: 60_000, max: 120 });
  if (limited) return limited;

  const { id } = await context.params;
  const body = await readBody(req, PatchBody);
  if (body instanceof NextResponse) return body;

  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  // Ownership is enforced by RLS on the update; a non-owner update matches 0 rows → null.
  const prep = await updateMeetingPrep({ prepId: id, goal: body.goal, topics: body.topics });
  if (!prep) return NextResponse.json({ error: "Couldn't update the prep (not found or not yours)." }, { status: 404 });
  return NextResponse.json({ prep });
}
