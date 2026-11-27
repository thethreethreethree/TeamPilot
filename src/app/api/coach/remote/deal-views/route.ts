import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { readBody } from "@/lib/api/validate";

/**
 * /api/coach/remote/deal-views — your saved deal-board views (revenue Phase 2, 0371; Gong F20.1 saved tabs, F20.13).
 *   GET → { views: [{ name, filters }] } — your own (RLS).
 *   POST { name, filters } saves (the latest per name wins) · { name, removed: true } takes one off.
 */
const Filters = z.object({
  whose: z.string().max(40).optional(),
  status: z.enum(["open", "won", "lost"]).optional(),
  stage: z.string().max(60).optional(),
  close: z.enum(["overdue", "this_month", "next_month", "this_quarter", "next_quarter", "none"]).optional(),
  accountId: z.string().uuid().optional(),
  risk: z.enum(["at_risk", "watch", "ok", "flagged"]).optional(),
  q: z.string().max(80).optional(),
}).strict();
const Body = z.union([
  z.object({ name: z.string().trim().min(1).max(40), filters: Filters }),
  z.object({ name: z.string().trim().min(1).max(40), removed: z.literal(true) }),
]);

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-deal-views-read", windowMs: 60_000, max: 120 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const db = callerScopedDb(req) ?? (await createClient());
  const { data, error } = await db.from("deal_board_views_current").select("name, filters").order("name").limit(50);
  if (error) {
    console.error(`[deal-views] read failed user=${ctx.userId}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't load your saved views." }, { status: 500 });
  }
  return NextResponse.json({ views: data ?? [] });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-deal-views-write", windowMs: 60_000, max: 30 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;
  const db = callerScopedDb(req) ?? (await createClient());
  const row = "removed" in body
    ? { company_id: ctx.companyId, user_id: ctx.userId, name: body.name, filters: {}, removed: true }
    // The search box isn't kept with a view (0388): a search is usually a name, and a saved one would outlive erasure.
    : { company_id: ctx.companyId, user_id: ctx.userId, name: body.name, filters: withoutSearch(body.filters), removed: false };
  const { error } = await db.from("deal_board_views").insert(row);
  if (error) {
    console.error(`[deal-views] save failed user=${ctx.userId}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't save that view." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/** A view's filters without the search text (0388). */
function withoutSearch(f: z.infer<typeof Filters>): Omit<z.infer<typeof Filters>, "q"> {
  const { q: _q, ...rest } = f;
  void _q;
  return rest;
}

