import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { recordAudit } from "@/lib/audit/recordAudit";
import { hiddenFrom } from "@/lib/coach/remote/hidePhrases";

/**
 * /api/coach/remote/[id]/hidden — is this call hidden by a phrase (0337, F33.8), and by which. Company-pinned.
 *   GET  → { hidden, phrases, canSee, hides: [{ id, phrase }] }. Anyone in the company: a manager the call is hidden
 *          from sees WHY ("the reason shown"), never the call; the rep and admins see it's hidden from others.
 *   POST { hideId } → an admin unhides (call_unhides; sticks for that phrase). Audited.
 */
const Unhide = z.object({ hideId: z.string().uuid() });

async function load(admin: ReturnType<typeof createAdminClient>, companyId: string, id: string) {
  const { data: hides, error } = await admin.from("call_hides").select("id, phrase").eq("company_id", companyId).eq("session_id", id);
  if (error) throw new Error(error.message);
  const rows = (hides ?? []) as Array<{ id: string; phrase: string }>;
  if (!rows.length) return [];
  const { data: un, error: uErr } = await admin.from("call_unhides").select("hide_id").eq("company_id", companyId).in("hide_id", rows.map((h) => h.id));
  if (uErr) throw new Error(uErr.message);
  const gone = new Set(((un ?? []) as Array<{ hide_id: string }>).map((u) => String(u.hide_id)));
  return rows.filter((h) => !gone.has(String(h.id))).map((h) => ({ id: String(h.id), phrase: h.phrase }));
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "call-hidden-read", windowMs: 60_000, max: 120 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;
  const admin = createAdminClient();
  try {
    const active = await load(admin, ctx.companyId, id);
    if (!active.length) return NextResponse.json({ hidden: false, phrases: [], canSee: true, hides: [] });
    // The database's own verdict (rss_call_hidden_for: not its rep, not a company admin), never re-derived here (§2.2).
    const canSee = !(await hiddenFrom(admin, [id], ctx.userId)).has(id);
    return NextResponse.json({ hidden: true, phrases: [...new Set(active.map((h) => h.phrase))], canSee, hides: ctx.isAdmin ? active : [] });
  } catch (e) {
    console.error(`[call-hidden] read failed session=${id}: ${e instanceof Error ? e.message : String(e)}`);
    return NextResponse.json({ error: "Couldn't check whether this call is hidden." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "call-hidden-write", windowMs: 60_000, max: 20 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: "Only a company admin can unhide a call." }, { status: 403 });
  const body = await readBody(req, Unhide);
  if (body instanceof NextResponse) return body;
  const { id } = await params;
  const admin = createAdminClient();
  const active = await load(admin, ctx.companyId, id).catch(() => null);
  if (active === null) return NextResponse.json({ error: "Couldn't unhide it." }, { status: 500 });
  if (!active.some((h) => h.id === body.hideId)) return NextResponse.json({ error: "That hide isn't active on this call." }, { status: 404 });
  const { error } = await admin.from("call_unhides").insert({ hide_id: body.hideId, company_id: ctx.companyId, unhidden_by: ctx.userId });
  if (error && error.code !== "23505") {
    console.error(`[call-hidden] unhide failed hide=${body.hideId}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't unhide it." }, { status: 500 });
  }
  await recordAudit(admin, { companyId: ctx.companyId, actorId: ctx.userId, action: "call.unhide", objectType: "coaching_session", objectId: id, meta: { hideId: body.hideId } });
  return NextResponse.json({ ok: true });
}
