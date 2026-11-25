import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { recordAudit } from "@/lib/audit/recordAudit";
import { activeHidePhrases, scanCallForHidePhrases } from "@/lib/coach/remote/hidePhrases";

/**
 * /api/coach/remote/hide-phrases — a company admin's phrases that hide calls (0337, F33.8). Admins only.
 *   GET    → the phrases (active ones), each with how many calls it currently hides.
 *   POST   { phrase } → added; the company's phone/video calls from the last 90 days are checked for it in the
 *          background (that phrase only). Audited.
 *   DELETE { phraseId } → retired: no new hides; calls it already hid stay hidden until an admin unhides them. Audited.
 * Service role, every statement pinned to the admin's company.
 */
export const maxDuration = 300;
const Post = z.object({ phrase: z.string().trim().min(3).max(120) });
const Del = z.object({ phraseId: z.string().uuid() });
const BACKFILL_DAYS = 90;

async function adminCtx(req: NextRequest) {
  const ctx = await resolveApiAuth(req);
  if (!ctx) return { res: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) } as const;
  if (!ctx.isAdmin) return { res: NextResponse.json({ error: "Only a company admin can manage hide phrases." }, { status: 403 }) } as const;
  return { ctx, admin: createAdminClient() } as const;
}

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "hide-phrases-read", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const g = await adminCtx(req);
  if ("res" in g) return g.res;
  try {
    const phrases = await activeHidePhrases(g.admin, g.ctx.companyId);
    const { data: hides, error } = phrases.length
      ? await g.admin.from("call_hides").select("id, phrase_id").eq("company_id", g.ctx.companyId).in("phrase_id", phrases.map((p) => p.id))
      : { data: [], error: null };
    if (error) throw new Error(error.message);
    const hideRows = (hides ?? []) as Array<{ id: string; phrase_id: string }>;
    const { data: un, error: uErr } = hideRows.length
      ? await g.admin.from("call_unhides").select("hide_id").eq("company_id", g.ctx.companyId).in("hide_id", hideRows.map((h) => h.id))
      : { data: [], error: null };
    if (uErr) throw new Error(uErr.message);
    const unhidden = new Set(((un ?? []) as Array<{ hide_id: string }>).map((u) => String(u.hide_id)));
    return NextResponse.json({
      phrases: phrases.map((p) => ({ ...p, hiding: hideRows.filter((h) => String(h.phrase_id) === p.id && !unhidden.has(String(h.id))).length })),
    });
  } catch (e) {
    console.error(`[hide-phrases] read failed company=${g.ctx.companyId}: ${e instanceof Error ? e.message : String(e)}`);
    return NextResponse.json({ error: "Couldn't load hide phrases." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "hide-phrases-write", windowMs: 60_000, max: 20 });
  if (limited) return limited;
  const g = await adminCtx(req);
  if ("res" in g) return g.res;
  const body = await readBody(req, Post);
  if (body instanceof NextResponse) return body;
  const { data: row, error } = await g.admin.from("hide_phrases").insert({ company_id: g.ctx.companyId, phrase: body.phrase, created_by: g.ctx.userId }).select("id").maybeSingle();
  if (error || !row) {
    console.error(`[hide-phrases] insert failed company=${g.ctx.companyId}: ${error?.message ?? "no row"}`);
    return NextResponse.json({ error: "Couldn't add the phrase." }, { status: 500 });
  }
  await recordAudit(g.admin, { companyId: g.ctx.companyId, actorId: g.ctx.userId, action: "call.hide_phrase_add", objectType: "company", objectId: g.ctx.companyId, meta: { phraseId: row.id, phrase: body.phrase } });
  // Recent calls are checked for this phrase only, after the response; new calls are checked as transcripts land.
  const since = new Date(Date.now() - BACKFILL_DAYS * 86_400_000).toISOString();
  const { data: recent, error: rErr } = await g.admin
    .from("coaching_sessions")
    .select("id")
    .eq("company_id", g.ctx.companyId)
    .in("context", ["phone", "video"])
    .gte("started_at", since)
    .order("started_at", { ascending: false })
    .limit(500);
  // A failed read is said so (checking: null), never reported as "no recent calls"; new calls are still checked.
  if (rErr) console.error(`[hide-phrases] recent-calls read failed company=${g.ctx.companyId}: ${rErr.message}`);
  const ids = rErr ? [] : ((recent ?? []) as Array<{ id: string }>).map((r) => String(r.id));
  const only = [{ id: String(row.id), phrase: body.phrase }];
  after(async () => {
    for (const id of ids) await scanCallForHidePhrases(g.admin, id, only);
  });
  return NextResponse.json({ ok: true, phraseId: row.id, checking: rErr ? null : ids.length }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const limited = rateLimit(req, { id: "hide-phrases-write", windowMs: 60_000, max: 20 });
  if (limited) return limited;
  const g = await adminCtx(req);
  if ("res" in g) return g.res;
  const body = await readBody(req, Del);
  if (body instanceof NextResponse) return body;
  const { data: p } = await g.admin.from("hide_phrases").select("id").eq("id", body.phraseId).eq("company_id", g.ctx.companyId).maybeSingle();
  if (!p) return NextResponse.json({ error: "Phrase not found." }, { status: 404 });
  const { error } = await g.admin.from("hide_phrase_retirements").insert({ phrase_id: body.phraseId, company_id: g.ctx.companyId, retired_by: g.ctx.userId });
  if (error && error.code !== "23505") {
    console.error(`[hide-phrases] retire failed phrase=${body.phraseId}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't retire the phrase." }, { status: 500 });
  }
  await recordAudit(g.admin, { companyId: g.ctx.companyId, actorId: g.ctx.userId, action: "call.hide_phrase_retire", objectType: "company", objectId: g.ctx.companyId, meta: { phraseId: body.phraseId } });
  return NextResponse.json({ ok: true });
}
