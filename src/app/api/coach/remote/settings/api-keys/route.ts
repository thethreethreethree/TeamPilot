import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { readBody } from "@/lib/api/validate";
import { recordAudit } from "@/lib/audit/recordAudit";
import { newApiKey } from "@/lib/api/publicApi";

/**
 * /api/coach/remote/settings/api-keys — the company's API keys (Engage plan E3, 0378). Company admins only.
 *   GET → { keys } — name, prefix, scopes, made, revoked, requests in the last 24 hours, last used.
 *   POST { name, scopes } → { key } — the key, shown ONCE (only its hash is stored); recorded in the audit log.
 *   POST { revoke: id } → revoked for good; recorded.
 * Writes use the service role after the admin check, pinned to the admin's company (0378 has no write policy).
 */
const Body = z.union([
  z.object({ name: z.string().trim().min(1).max(60), scopes: z.array(z.enum(["read", "mcp"])).min(1).max(2) }),
  z.object({ revoke: z.string().uuid() }),
]);

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "api-keys-read", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: "Only a company admin can manage API keys." }, { status: 403 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("api_keys").select("id, name, prefix, scopes, created_at, revoked_at").eq("company_id", ctx.companyId).order("created_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: "Couldn't load API keys." }, { status: 500 });
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const keys = [];
  for (const k of (data ?? []) as Array<{ id: string; name: string; prefix: string; scopes: string[]; created_at: string; revoked_at: string | null }>) {
    const [{ count, error: cErr }, { data: last, error: lErr }] = await Promise.all([
      admin.from("api_usage").select("id", { count: "exact", head: true }).eq("company_id", ctx.companyId).eq("key_id", k.id).gte("at", since),
      admin.from("api_usage").select("at").eq("company_id", ctx.companyId).eq("key_id", k.id).order("at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (cErr || lErr) return NextResponse.json({ error: "Couldn't load API key usage." }, { status: 500 });
    keys.push({ id: k.id, name: k.name, prefix: k.prefix, scopes: k.scopes, createdAt: k.created_at, revokedAt: k.revoked_at, requests24h: count ?? 0, lastUsedAt: last?.at ?? null });
  }
  return NextResponse.json({ keys });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "api-keys-write", windowMs: 60_000, max: 10 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: "Only a company admin can manage API keys." }, { status: 403 });
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;
  const admin = createAdminClient();
  if ("revoke" in body) {
    const { data, error } = await admin.from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("company_id", ctx.companyId).eq("id", body.revoke).is("revoked_at", null).select("id");
    if (error) return NextResponse.json({ error: "Couldn't revoke that key." }, { status: 500 });
    if (!data?.length) return NextResponse.json({ error: "Key not found, or already revoked." }, { status: 404 });
    await recordAudit(admin, { companyId: ctx.companyId, actorId: ctx.userId, action: "api_key.revoke", objectType: "api_key", objectId: body.revoke });
    return NextResponse.json({ ok: true });
  }
  const k = newApiKey();
  const { data, error } = await admin.from("api_keys").insert({ company_id: ctx.companyId, name: body.name, prefix: k.prefix, key_hash: k.hash, scopes: [...new Set(body.scopes)], created_by: ctx.userId }).select("id").single();
  if (error || !data) {
    console.error(`[api-keys] create failed company=${ctx.companyId}: ${error?.message}`);
    return NextResponse.json({ error: "Couldn't make the key." }, { status: 500 });
  }
  await recordAudit(admin, { companyId: ctx.companyId, actorId: ctx.userId, action: "api_key.create", objectType: "api_key", objectId: String(data.id), meta: { name: body.name, scopes: body.scopes } });
  return NextResponse.json({ id: String(data.id), key: k.key });
}
