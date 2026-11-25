import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { getSession } from "@/lib/data/salesCoach";
import { treeAllowsRep } from "@/lib/api/treeAccess";
import { isRemoteContext } from "@/lib/coach/sessionContext";
import { cleanSpeakerName, latestSpeakerNames } from "@/lib/coach/remote/speakerNames";

/**
 * /api/coach/remote/[id]/speaker-names — names for a phone/video call's two speakers (0343; Gong ledger F8.5).
 *   GET  → { names: { rep?, customer? } } — read through the caller's own client (RLS: anyone who can open the call;
 *          never a hidden call's).
 *   POST { speaker: "rep" | "customer", name } → sets it (an empty name clears it). Only the call's rep or a manager,
 *          and only on a call they can open. Written with the service role, company-pinned; append-only.
 * A customer's name is personal data: legal erasure deletes these rows (migration 0343 adds them to it).
 */
const MISSING = new Set(["PGRST205", "42P01"]);
const Body = z.object({ speaker: z.enum(["rep", "customer"]), name: z.string().max(200) });

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "speaker-names-read", windowMs: 60_000, max: 120 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;
  const db = callerScopedDb(req) ?? (await createClient());
  const { data, error } = await db.from("call_speaker_names").select("id, speaker, name").eq("company_id", ctx.companyId).eq("session_id", id).order("id", { ascending: false }).limit(100);
  if (error) {
    if (MISSING.has(String(error.code))) return NextResponse.json({ names: {}, notReady: true });
    console.error(`[speaker-names] read failed session=${id}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't load the speaker names." }, { status: 500 });
  }
  return NextResponse.json({ names: latestSpeakerNames((data ?? []) as Array<{ id: number; speaker: string; name: string }>) });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "speaker-names-write", windowMs: 60_000, max: 30 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;
  const { id } = await params;
  let session;
  try {
    session = await getSession(id, callerScopedDb(req) ?? (await createClient()));
  } catch (e) {
    console.error(`[speaker-names] session read failed session=${id}: ${e instanceof Error ? e.message : String(e)}`);
    return NextResponse.json({ error: "Couldn't check this call." }, { status: 500 });
  }
  if (!session || !isRemoteContext(session.context)) return NextResponse.json({ error: "Call not found." }, { status: 404 });
  // The rep names their own call; otherwise a manager whose reporting tree includes the call's rep (the service-role
  // write below bypasses RLS, so the tree is asked explicitly — treeAllowsRep, the database's own rule).
  if (session.agentId !== ctx.userId && !((await requireSalesCoachManager(req)) && (await treeAllowsRep(req, session.agentId)))) {
    return NextResponse.json({ error: "Only the call's rep or a manager can name its speakers." }, { status: 403 });
  }
  const name = cleanSpeakerName(body.name);
  const { error } = await createAdminClient()
    .from("call_speaker_names")
    .insert({ company_id: ctx.companyId, session_id: id, speaker: body.speaker, name, set_by: ctx.userId });
  if (error) {
    console.error(`[speaker-names] insert failed session=${id}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't save the name." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, speaker: body.speaker, name: name || null });
}
