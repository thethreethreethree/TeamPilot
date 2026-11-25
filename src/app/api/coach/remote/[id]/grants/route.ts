import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { recordAudit } from "@/lib/audit/recordAudit";
import { grantsForCall } from "@/lib/coach/remote/callGrants";
import { isRemoteContext } from "@/lib/coach/sessionContext";

/**
 * /api/coach/remote/[id]/grants — give one teammate access to one call (0336; F3.8; founder "Admin grants, logged").
 *   GET    → the call's grants (active and revoked) with names. Company admins only.
 *   POST   { granteeId, reason } → a grant; the rep and the grantee are told (bell); audited (call.grant).
 *   DELETE { grantId } → revoked (a row in call_access_revocations); audited (call.grant_revoke).
 * Service role, every statement pinned to the admin's company; the call must be a phone/video call in that company and
 * the grantee an active member of it (not the call's own rep).
 */
const Post = z.object({ granteeId: z.string().uuid(), reason: z.string().trim().min(1).max(300) });
const Del = z.object({ grantId: z.string().uuid() });

async function gate(req: NextRequest, id: string) {
  const ctx = await resolveApiAuth(req);
  if (!ctx) return { res: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) } as const;
  if (!ctx.isAdmin) return { res: NextResponse.json({ error: "Only a company admin can give access to a call." }, { status: 403 }) } as const;
  const admin = createAdminClient();
  const { data: s, error } = await admin.from("coaching_sessions").select("id, agent_id, context, client_label").eq("id", id).eq("company_id", ctx.companyId).maybeSingle();
  if (error) {
    console.error(`[call-grants] session read failed session=${id}: ${error.message}`);
    return { res: NextResponse.json({ error: "Couldn't load the call." }, { status: 500 }) } as const;
  }
  if (!s || !isRemoteContext(String(s.context))) return { res: NextResponse.json({ error: "Call not found." }, { status: 404 }) } as const;
  return { ctx, admin, session: s as { id: string; agent_id: string; context: string; client_label: string | null } } as const;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "call-grants-read", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const { id } = await params;
  const g = await gate(req, id);
  if ("res" in g) return g.res;
  try {
    const grants = await grantsForCall(g.admin, g.ctx.companyId, id);
    const ids = [...new Set(grants.flatMap((x) => [x.granteeId, x.grantedBy]))];
    const { data: profs } = ids.length ? await g.admin.from("profiles").select("id, full_name").eq("company_id", g.ctx.companyId).in("id", ids) : { data: [] };
    const name = new Map(((profs ?? []) as Array<{ id: string; full_name: string | null }>).map((p) => [String(p.id), p.full_name ?? "A teammate"]));
    return NextResponse.json({ grants: grants.map((x) => ({ ...x, granteeName: name.get(x.granteeId) ?? "A teammate", grantedByName: name.get(x.grantedBy) ?? "An admin" })) });
  } catch (e) {
    console.error(`[call-grants] read failed session=${id}: ${e instanceof Error ? e.message : String(e)}`);
    return NextResponse.json({ error: "Couldn't load who has access." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "call-grants-write", windowMs: 60_000, max: 20 });
  if (limited) return limited;
  const { id } = await params;
  const g = await gate(req, id);
  if ("res" in g) return g.res;
  const body = await readBody(req, Post);
  if (body instanceof NextResponse) return body;
  if (body.granteeId === g.session.agent_id) return NextResponse.json({ error: "That's the rep on this call — they can already open it." }, { status: 400 });
  const { data: who } = await g.admin.from("profiles").select("id, full_name, status").eq("id", body.granteeId).eq("company_id", g.ctx.companyId).maybeSingle();
  if (!who || who.status === "removed") return NextResponse.json({ error: "That person isn't on your team." }, { status: 404 });
  const existing = (await grantsForCall(g.admin, g.ctx.companyId, id)).find((x) => x.active && x.granteeId === body.granteeId);
  if (existing) return NextResponse.json({ error: "They already have access to this call." }, { status: 409 });
  const { data: row, error } = await g.admin
    .from("call_access_grants")
    .insert({ company_id: g.ctx.companyId, session_id: id, grantee_id: body.granteeId, granted_by: g.ctx.userId, reason: body.reason })
    .select("id")
    .maybeSingle();
  if (error || !row) {
    console.error(`[call-grants] insert failed session=${id}: ${error?.message ?? "no row"}`);
    return NextResponse.json({ error: "Couldn't give access." }, { status: 500 });
  }
  await recordAudit(g.admin, { companyId: g.ctx.companyId, actorId: g.ctx.userId, action: "call.grant", objectType: "coaching_session", objectId: id, meta: { grantId: row.id, granteeId: body.granteeId, reason: body.reason } });
  // The rep and the grantee are told. Best-effort: the grant stands either way. Deduped per (recipient, type, call).
  const label = g.session.client_label ?? null;
  for (const [recipient, role] of [[g.session.agent_id, "rep"], [body.granteeId, "grantee"]] as const) {
    const { error: nErr } = await g.admin.from("manager_notifications").insert({
      company_id: g.ctx.companyId,
      recipient_id: recipient,
      agent_id: g.session.agent_id,
      session_id: id,
      type: "call_access_granted",
      payload: { role, client_label: label, grantee_name: (who.full_name as string | null) ?? null },
    });
    if (nErr && nErr.code !== "23505") console.error(`[call-grants] notify failed session=${id}: ${nErr.message}`);
  }
  return NextResponse.json({ ok: true, grantId: row.id }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "call-grants-write", windowMs: 60_000, max: 20 });
  if (limited) return limited;
  const { id } = await params;
  const g = await gate(req, id);
  if ("res" in g) return g.res;
  const body = await readBody(req, Del);
  if (body instanceof NextResponse) return body;
  const grant = (await grantsForCall(g.admin, g.ctx.companyId, id)).find((x) => x.id === body.grantId);
  if (!grant) return NextResponse.json({ error: "Grant not found." }, { status: 404 });
  if (!grant.active) return NextResponse.json({ ok: true, alreadyRevoked: true });
  const { error } = await g.admin.from("call_access_revocations").insert({ grant_id: grant.id, company_id: g.ctx.companyId, revoked_by: g.ctx.userId });
  if (error && error.code !== "23505") {
    console.error(`[call-grants] revoke failed grant=${grant.id}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't take access back." }, { status: 500 });
  }
  await recordAudit(g.admin, { companyId: g.ctx.companyId, actorId: g.ctx.userId, action: "call.grant_revoke", objectType: "coaching_session", objectId: id, meta: { grantId: grant.id, granteeId: grant.granteeId } });
  return NextResponse.json({ ok: true });
}
