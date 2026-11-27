import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hiddenInCompanyFrom } from "@/lib/coach/remote/hidePhrases";
import { isAdminRole } from "@/lib/roles";
import { authenticateApiKey, OUTSIDE_READER, paging, recordApiUsage } from "./publicApi";

/**
 * The read endpoints of /api/v1 (Engage plan E3; Gong F31.1–F31.3; the audit log F31.5), one handler. Every statement pins the key's
 * company (the service role bypasses RLS, so this filter is the tenant boundary), lists are ordered by a unique key
 * last, and calls with an active hide are left out (OUTSIDE_READER). No transcripts leave through this API.
 */
export type Resource = "deals" | "accounts" | "contacts" | "calls" | "audit";

export async function readResource(req: Request, resource: Resource): Promise<NextResponse> {
  const route = `/api/v1/${resource}`;
  const caller = await authenticateApiKey(req, "read", route);
  if (caller instanceof NextResponse) return caller;
  const url = new URL(req.url);
  const { from, to, limit, page } = paging(url);
  const admin = createAdminClient();
  const done = async (body: Record<string, unknown>, status = 200) => {
    await recordApiUsage(caller, route, status);
    return NextResponse.json(body, { status });
  };
  if (resource === "deals") {
    const { data, error } = await admin
      .from("remote_prospects_current")
      .select("id, rep_id, name, status, stage_label, amount, close_date, next_call_date, last_call_at, account_id, created_at")
      .eq("company_id", caller.companyId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);
    if (error) return done({ error: "Couldn't read deals." }, 500);
    return done({ data: (data ?? []).map((d) => ({ id: d.id, name: d.name, status: d.status, stage: d.stage_label, amount: d.amount, closeDate: d.close_date, nextCallDate: d.next_call_date, lastCallAt: d.last_call_at, accountId: d.account_id, repId: d.rep_id, createdAt: d.created_at })), page, limit });
  }
  if (resource === "accounts") {
    const { data, error } = await admin.from("accounts_current").select("id, name, created_at").eq("company_id", caller.companyId).order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to);
    if (error) return done({ error: "Couldn't read accounts." }, 500);
    return done({ data: (data ?? []).map((a) => ({ id: a.id, name: a.name, createdAt: a.created_at })), page, limit });
  }
  if (resource === "contacts") {
    const { data, error } = await admin.from("contacts_current").select("id, name, title, account_id, email, phone, created_at").eq("company_id", caller.companyId).order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to);
    if (error) return done({ error: "Couldn't read contacts." }, 500);
    return done({ data: (data ?? []).map((c) => ({ id: c.id, name: c.name, title: c.title, accountId: c.account_id, email: c.email, phone: c.phone, createdAt: c.created_at })), page, limit });
  }
  if (resource === "audit") {
    // The audit log (0284; Gong F31.5) is for company admins: the key's maker must still be one (a key outlives a role
    // change, so this is checked on every request, not only when the key was made).
    const { data: maker, error: mErr } = await admin.from("profiles").select("role, status").eq("company_id", caller.companyId).eq("id", caller.createdBy).maybeSingle();
    if (mErr) return done({ error: "Couldn't read the audit log." }, 500);
    if (!maker || maker.status === "removed" || !isAdminRole(maker.role as string | null)) {
      return done({ error: "The audit log is for company admins; the person who made this key isn't one now." }, 403);
    }
    // ?before=<id> pages by id (review 2026-11-27): the log grows while a tool reads it, and page offsets would repeat
    // rows. ?page still works for the first page.
    const before = Number(url.searchParams.get("before"));
    let q = admin.from("audit_log").select("id, actor_id, action, object_type, object_id, meta, created_at").eq("company_id", caller.companyId).order("id", { ascending: false });
    q = Number.isInteger(before) && before > 0 ? q.lt("id", before).limit(limit) : q.range(from, to);
    const { data, error } = await q;
    if (error) return done({ error: "Couldn't read the audit log." }, 500);
    // What leaves keeps this API's own rule (review 2026-11-27): a row about a call with an active hide is left out, and
    // free text or secrets in the details (a hide phrase, a grant's reason, a webhook URL, an erasure hint) are removed.
    let hidden: Set<string>;
    try {
      hidden = await hiddenInCompanyFrom(admin, caller.companyId, OUTSIDE_READER);
    } catch {
      return done({ error: "Couldn't read the audit log." }, 500);
    }
    const rows = (data ?? []).filter((r) => !(r.object_type === "coaching_session" && hidden.has(String(r.object_id))));
    const last = (data ?? []).at(-1);
    return done({
      data: rows.map((r) => ({ id: r.id, at: r.created_at, action: r.action, actorId: r.actor_id, objectType: r.object_type, objectId: r.object_id, meta: auditMetaForApi(r.meta) })),
      page,
      limit,
      next: (data ?? []).length === limit && last ? `?before=${last.id}&limit=${limit}` : null,
    });
  }
  let hidden: Set<string>;
  try {
    hidden = await hiddenInCompanyFrom(admin, caller.companyId, OUTSIDE_READER);
  } catch {
    return done({ error: "Couldn't read calls." }, 500);
  }
  const { data, error } = await admin
    .from("coaching_sessions")
    .select("id, agent_id, context, session_kind, started_at, ended_at, outcome")
    .eq("company_id", caller.companyId)
    .in("context", ["phone", "video"])
    .order("started_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);
  if (error) return done({ error: "Couldn't read calls." }, 500);
  return done({
    data: (data ?? []).filter((s) => !hidden.has(String(s.id))).map((s) => ({ id: s.id, repId: s.agent_id, channel: s.context, kind: s.session_kind, startedAt: s.started_at, endedAt: s.ended_at, outcome: s.outcome })),
    page,
    limit,
    note: "Calls with an active hide are left out.",
  });
}

/** Audit details keys that hold free text or secrets: never sent through the API (the app's admin view keeps them). */
export const AUDIT_META_WITHHELD = ["phrase", "reason", "url", "hint", "note", "text", "value", "query", "name", "email"] as const;

/** An audit row's details with the withheld keys removed (one level; nested objects are dropped). Pure. */
export function auditMetaForApi(meta: unknown): Record<string, unknown> {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta as Record<string, unknown>)) {
    if ((AUDIT_META_WITHHELD as readonly string[]).includes(k)) continue;
    if (v !== null && typeof v === "object") continue;
    out[k] = v;
  }
  return out;
}

