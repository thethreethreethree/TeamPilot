import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { readBody } from "@/lib/api/validate";

/**
 * /api/coach/remote/deal-stages — the company's deal stages (revenue Phase 2, 0371; Gong F20.1 tabs).
 *   GET → { stages: [{ name, kind }] | null } — null when the company has no list yet (stage names stay free text).
 *   POST { stages } → a new list (the whole list, one row, §3.1). Admins and Sales Coach managers only: 0371's insert
 *        policy (is_sales_coach_manager) is the gate, and its CHECK (rss_valid_stage_list) is the one rule for a valid
 *        list (1–20 stages, names once, at least one open) — this route does not re-derive it (§2.2).
 */
const Body = z.object({
  stages: z.array(z.object({ name: z.string().trim().min(1).max(60), kind: z.enum(["open", "won", "lost"]) })).min(1).max(20),
});

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-deal-stages-read", windowMs: 60_000, max: 120 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const db = callerScopedDb(req) ?? (await createClient());
  const { data, error } = await db.from("deal_stage_list_current").select("stages, created_at").maybeSingle();
  if (error) {
    console.error(`[deal-stages] read failed company=${ctx.companyId}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't load the deal stages." }, { status: 500 });
  }
  return NextResponse.json({ stages: (data?.stages as unknown) ?? null, setAt: data?.created_at ?? null });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-deal-stages-write", windowMs: 60_000, max: 20 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;
  const db = callerScopedDb(req) ?? (await createClient());
  const { error } = await db.from("deal_stage_lists").insert({ company_id: ctx.companyId, stages: body.stages, actor_id: ctx.userId });
  if (error) {
    if (error.code === "23514") return NextResponse.json({ error: "Each stage needs its own name, and at least one stage must be open." }, { status: 400 });
    if (error.code === "42501") return NextResponse.json({ error: "Only a manager or admin can change the stages." }, { status: 403 });
    console.error(`[deal-stages] save failed company=${ctx.companyId}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't save the stages." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
