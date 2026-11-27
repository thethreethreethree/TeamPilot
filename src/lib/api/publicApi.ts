import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bearerToken } from "@/lib/api/callerScopedDb";

/**
 * The public read API (Engage plan E3, 0378; Gong M31). A company admin makes a key; an outside tool sends it as
 * `Authorization: Bearer els_…`. Only the key's SHA-256 is stored, so a stolen database never yields a working key.
 * Limits as Gong's (F31.6): 3 requests a second and 10,000 a day per key; over them, 429 with Retry-After.
 * Every request is recorded (api_usage) for the usage report.
 */
export const API_PER_SECOND = 3;
export const API_PER_DAY = 10_000;

export function newApiKey(): { key: string; prefix: string; hash: string } {
  const key = `els_${randomBytes(32).toString("base64url")}`;
  return { key, prefix: key.slice(0, 10), hash: hashApiKey(key) };
}
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

export type ApiCaller = { keyId: string; companyId: string; createdBy: string; scopes: string[] };

/** The key on a request, checked: a live key with `scope`, inside its limits. Returns the caller or the response to send. */
export async function authenticateApiKey(req: Request, scope: "read" | "mcp" | "upload", route: string): Promise<ApiCaller | NextResponse> {
  const key = bearerToken(req);
  if (!/^els_[A-Za-z0-9_-]{40,}$/.test(key)) return NextResponse.json({ error: "Send a valid API key as 'Authorization: Bearer els_…'." }, { status: 401 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("api_keys").select("id, company_id, created_by, scopes, revoked_at").eq("key_hash", hashApiKey(key)).maybeSingle();
  if (error) return NextResponse.json({ error: "The API is unavailable. Try again." }, { status: 503 });
  if (!data || data.revoked_at) return NextResponse.json({ error: "That API key isn't valid." }, { status: 401 });
  const scopes = (data.scopes as string[]) ?? [];
  if (!scopes.includes(scope)) return NextResponse.json({ error: `That key can't use the ${scope === "mcp" ? "MCP server" : scope === "upload" ? "call upload" : "read API"}.` }, { status: 403 });
  const caller = { keyId: String(data.id), companyId: String(data.company_id), createdBy: String(data.created_by), scopes };
  if (!underPerSecond(caller.keyId)) {
    await recordApiUsage(caller, route, 429);
    return NextResponse.json({ error: `At most ${API_PER_SECOND} requests a second per key.` }, { status: 429, headers: { "Retry-After": "1" } });
  }
  const { count, error: cErr } = await admin.from("api_usage").select("id", { count: "exact", head: true }).eq("company_id", caller.companyId).eq("key_id", caller.keyId).gte("at", new Date(Date.now() - 86_400_000).toISOString());
  if (cErr) return NextResponse.json({ error: "The API is unavailable. Try again." }, { status: 503 });
  if ((count ?? 0) >= API_PER_DAY) {
    return NextResponse.json({ error: `This key has made ${API_PER_DAY.toLocaleString("en-US")} requests in the last 24 hours.` }, { status: 429, headers: { "Retry-After": "3600" } });
  }
  return caller;
}

/**
 * Per key, per second, on this server instance (the shared rateLimit keys by the caller's address; an API key is the
 * caller here). The daily limit above is counted in the database, so it holds across instances.
 */
const recent = new Map<string, number[]>();
export function underPerSecond(keyId: string, now = Date.now()): boolean {
  const xs = (recent.get(keyId) ?? []).filter((t) => now - t < 1000);
  if (xs.length >= API_PER_SECOND) {
    recent.set(keyId, xs);
    return false;
  }
  xs.push(now);
  recent.set(keyId, xs);
  if (recent.size > 5000) for (const [k, v] of recent) if (!v.some((t) => now - t < 1000)) recent.delete(k);
  return true;
}

/** One request on the record. A failed write is logged, never fatal: the answer has already been decided. */
export async function recordApiUsage(caller: ApiCaller, route: string, status: number): Promise<void> {
  const { error } = await createAdminClient().from("api_usage").insert({ key_id: caller.keyId, company_id: caller.companyId, route: route.slice(0, 80), status });
  if (error) console.error(`[api] usage not recorded key=${caller.keyId}: ${error.message}`);
}

/** ?limit (1–100, default 50) and ?page (from 0) for a list endpoint. */
export function paging(url: URL): { from: number; to: number; limit: number; page: number } {
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50));
  const page = Math.max(0, Math.floor(Number(url.searchParams.get("page")) || 0));
  return { from: page * limit, to: page * limit + limit - 1, limit, page };
}

/** Nobody a hide exempts: every call with an active hide is left out of what leaves through the API. */
export const OUTSIDE_READER = "00000000-0000-0000-0000-000000000000";
