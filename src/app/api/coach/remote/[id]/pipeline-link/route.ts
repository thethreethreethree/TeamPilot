import { NextRequest, NextResponse } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { getSession } from "@/lib/data/salesCoach";
import { isRemoteContext } from "@/lib/coach/sessionContext";
import { listProspects } from "@/lib/coach/remote/prospects";

/**
 * GET /api/coach/remote/:id/pipeline-link — which prospect a phone/video call belongs to, and, for the call's own rep,
 * their open prospects to add it to (2026-11-23). Production had 0 calls linked: the only control lived in Macro Mode's
 * call view and could only create a NEW prospect. The writes reuse the existing routes — POST /prospects { name,
 * sessionId } (new) and POST /prospects/:pid { action: "link", sessionId } (existing; 0304 lets only the call's rep
 * link it). Read through the caller's client.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "remote-pipeline-link", windowMs: 60_000, max: 120 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Call not found." }, { status: 404 });
  const db = callerScopedDb(req) ?? (await createClient());
  const session = await getSession(id, db);
  if (!session) return NextResponse.json({ error: "Call not found." }, { status: 404 });
  if (!isRemoteContext(session.context)) return NextResponse.json({ remote: false });

  const { data: link, error: lErr } = await db.from("remote_prospect_calls").select("prospect_id").eq("session_id", id).maybeSingle();
  // A failed read is not "not in the pipeline": offering "add" for a linked call would invite a duplicate.
  if (lErr) {
    console.error(`[pipeline-link] link read failed session=${id}: ${lErr.message}`);
    return NextResponse.json({ error: "Couldn't check this call's pipeline." }, { status: 500 });
  }
  const isOwner = session.agentId === ctx.userId;
  let prospect: { id: string; name: string | null; status: string } | null = null;
  if (link?.prospect_id) {
    const { data: pc, error } = await db.from("remote_prospects_current").select("id, name, status").eq("id", link.prospect_id).maybeSingle();
    if (error) return NextResponse.json({ error: "Couldn't check this call's pipeline." }, { status: 500 });
    if (pc) prospect = { id: String(pc.id), name: (pc.name as string | null) ?? null, status: String(pc.status) };
  }
  let options: Array<{ id: string; name: string; organization: string | null }> = [];
  if (!prospect && isOwner) {
    const mine = await listProspects(db, ctx.userId);
    if (mine === null) return NextResponse.json({ error: "Couldn't load your pipeline." }, { status: 500 });
    options = mine
      .filter((p) => p.status === "open")
      .map((p) => ({ id: p.id, name: p.name ?? "Unnamed prospect", organization: p.organization }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  return NextResponse.json({ remote: true, live: session.status === "active", isOwner, label: session.clientLabel ?? null, prospect, options });
}
