import { NextRequest, NextResponse } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { AUDIT_ACTIONS } from "@/lib/audit/recordAudit";

/**
 * GET /api/coach/remote/audit — the company's audit log, newest first (RSS Phase 8, migration 0284; Gong F31.5).
 * Company admins only: checked here (ctx.isAdmin) for a clear 403, and again by 0284's read rule, because the read
 * goes through the caller's own client. ?action=<one of AUDIT_ACTIONS> narrows it; ?before=<id> pages back.
 */
const MISSING = new Set(["PGRST205", "42P01"]);
const PAGE = 100;

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-audit-read", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: "Only a company admin can read the audit log." }, { status: 403 });
  const sp = new URL(req.url).searchParams;
  const action = sp.get("action");
  if (action && !(AUDIT_ACTIONS as readonly string[]).includes(action)) return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  const before = Number(sp.get("before"));

  const db = callerScopedDb(req) ?? (await createClient());
  let q = db
    .from("audit_log")
    .select("id, actor_id, action, object_type, object_id, meta, created_at")
    .eq("company_id", ctx.companyId)
    .order("id", { ascending: false })
    .limit(PAGE + 1);
  if (action) q = q.eq("action", action);
  if (Number.isInteger(before) && before > 0) q = q.lt("id", before);
  const { data, error } = await q;
  if (error) {
    if (MISSING.has(String(error.code))) return NextResponse.json({ rows: [], more: false, notReady: "The audit log is waiting on database migration 0284." });
    console.error(`[audit] read failed company=${ctx.companyId}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't load the audit log." }, { status: 500 });
  }
  type Row = { id: number; actor_id: string | null; action: string; object_type: string; object_id: string; meta: Record<string, unknown>; created_at: string };
  const all = (data ?? []) as Row[];
  const rows = all.slice(0, PAGE);
  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter((x): x is string => !!x))];
  const { data: people } = actorIds.length
    ? await db.from("profiles").select("id, full_name").eq("company_id", ctx.companyId).in("id", actorIds)
    : { data: [] };
  const names = new Map(((people ?? []) as Array<{ id: string; full_name: string | null }>).map((p) => [String(p.id), p.full_name]));
  return NextResponse.json({
    rows: rows.map((r) => ({
      id: r.id,
      at: r.created_at,
      action: r.action,
      actorName: r.actor_id ? (names.get(r.actor_id) ?? null) : null,
      objectType: r.object_type,
      objectId: r.object_id,
      meta: r.meta,
    })),
    more: all.length > PAGE,
  });
}
