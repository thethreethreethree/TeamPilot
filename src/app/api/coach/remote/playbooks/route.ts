import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { readBody } from "@/lib/api/validate";
import { parseElements, PLAYBOOKS } from "@/lib/coach/remote/revenue/playbook";

/**
 * /api/coach/remote/playbooks — the company's deal playbook (revenue Phase 3b, 0373; Gong F20.6).
 *   GET → { playbook: { key, name, elements } | null, builtIns } — null when none is chosen yet.
 *   POST { key: "meddicc" | "bant" | "spiced" } or { key: "custom", name, elements } → the company's playbook from now on.
 *        An admin or Sales Coach manager: 0373's insert policy is the gate; its CHECK (rss_valid_playbook) the rule.
 */
const Body = z.discriminatedUnion("key", [
  z.object({ key: z.enum(["meddicc", "bant", "spiced"]) }),
  z.object({ key: z.literal("custom"), name: z.string().trim().min(1).max(40), elements: z.array(z.unknown()).min(1).max(10) }),
]);

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-playbooks-read", windowMs: 60_000, max: 120 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const db = callerScopedDb(req) ?? (await createClient());
  const { data, error } = await db.from("deal_playbook_current").select("key, name, elements").maybeSingle();
  if (error) {
    console.error(`[playbooks] read failed company=${ctx.companyId}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't load the playbook." }, { status: 500 });
  }
  return NextResponse.json({ playbook: data ?? null, builtIns: PLAYBOOKS });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-playbooks-write", windowMs: 60_000, max: 20 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;
  let name: string;
  let elements: unknown;
  if (body.key === "custom") {
    const parsed = parseElements(body.elements);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    name = body.name;
    elements = parsed.elements;
  } else {
    name = PLAYBOOKS[body.key].name;
    elements = PLAYBOOKS[body.key].elements;
  }
  const db = callerScopedDb(req) ?? (await createClient());
  const { error } = await db.from("deal_playbooks").insert({ company_id: ctx.companyId, key: body.key, name, elements, actor_id: ctx.userId });
  if (error) {
    if (error.code === "42501") return NextResponse.json({ error: "Only a manager or admin can choose the playbook." }, { status: 403 });
    console.error(`[playbooks] save failed company=${ctx.companyId}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't save the playbook." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
