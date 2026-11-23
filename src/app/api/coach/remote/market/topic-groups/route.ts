import { NextRequest, NextResponse } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { computeMarket, topicKey } from "@/lib/coach/remote/market";
import { readMarketInputs, readTopicGroups } from "@/lib/coach/remote/marketRead";
import { candidates } from "@/lib/coach/remote/topicSuggest";

/**
 * /api/coach/remote/market/topic-groups — the company's Market topic groups (2026-11-23, 0319; founder picker "AI
 * suggests, manager OKs").
 *   GET    → { canManage, groups: [{ id, name, members, source, createdAt }] } — anyone in the company (groups are how
 *            the company's topics are counted).
 *   POST   { module, name, members[], source: "ai_suggested"|"manager", replaces? } (managers) → stores a group. Every
 *            member must be a topic on 2+ calls in the manager's last 90 days and not in another group (topicSuggest
 *            candidates) — so no one-off label, which could be one customer's words, lands in a company table.
 *            `replaces` retires that group in the same step (an edit is retire + new, §3.1).
 *   DELETE ?id= (managers) → ungroup: a retirement row.
 * Writes use the service role after requireSalesCoachManager, pinned to the caller's company.
 */
const MISSING = new Set(["PGRST205", "42P01"]);
const NOT_READY = "Topic groups are waiting on database migration 0319.";

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "topic-groups-read", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const db = callerScopedDb(req) ?? (await createClient());
  const [groups, mgr] = await Promise.all([readTopicGroups(db, ctx.companyId), requireSalesCoachManager(req)]);
  if (!groups.ok) {
    console.error(`[topic-groups] read failed company=${ctx.companyId}: ${groups.message}`);
    return NextResponse.json({ error: "Couldn't load the topic groups." }, { status: 500 });
  }
  return NextResponse.json({ canManage: !!mgr, groups: groups.groups });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "topic-groups-write", windowMs: 60_000, max: 30 });
  if (limited) return limited;
  const mgr = await requireSalesCoachManager(req);
  if (!mgr) return NextResponse.json({ error: "Managers only." }, { status: 403 });
  let b: { module?: unknown; name?: unknown; members?: unknown; source?: unknown; replaces?: unknown };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const callModule = b.module === "sales_coach" ? "sales_coach" : "remote_sales";
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const members = Array.isArray(b.members) ? [...new Set(b.members.filter((m): m is string => typeof m === "string").map((m) => m.trim().toLowerCase()).filter(Boolean))] : [];
  const source = b.source === "ai_suggested" ? "ai_suggested" : "manager";
  const replaces = typeof b.replaces === "string" ? b.replaces : null;
  if (!name || name.length > 80) return NextResponse.json({ error: "Give the group a name (up to 80 characters)." }, { status: 400 });
  if (members.length < 2 || members.length > 40) return NextResponse.json({ error: "A group needs at least two topics." }, { status: 400 });

  const db = callerScopedDb(req) ?? (await createClient());
  const [inputs, groups] = await Promise.all([readMarketInputs(db, callModule, 90), readTopicGroups(db, mgr.companyId)]);
  if (!inputs.ok || !groups.ok) {
    console.error(`[topic-groups] check read failed company=${mgr.companyId}`);
    return NextResponse.json({ error: "Couldn't check the topics — try again." }, { status: 500 });
  }
  if (replaces && !groups.groups.some((g) => g.id === replaces)) return NextResponse.json({ error: "That group no longer exists." }, { status: 404 });
  const others = groups.groups.filter((g) => g.id !== replaces);
  const allowed = new Set(candidates(computeMarket(inputs.calls, inputs.intel, 10_000, others).topics).map((c) => topicKey(c.name)));
  const bad = members.filter((m) => !allowed.has(topicKey(m)));
  if (bad.length) return NextResponse.json({ error: `Only topics raised on 2 or more calls and not in another group can be grouped: ${bad.slice(0, 3).join(", ")}.` }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("market_topic_groups")
    .insert({ company_id: mgr.companyId, name, members, source, created_by: mgr.userId })
    .select("id, created_at")
    .maybeSingle();
  if (error) {
    if (MISSING.has(String(error.code))) return NextResponse.json({ error: NOT_READY }, { status: 503 });
    console.error(`[topic-groups] insert failed company=${mgr.companyId}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't save the group." }, { status: 500 });
  }
  if (replaces) {
    const { error: rErr } = await admin.from("market_topic_group_retirements").insert({ group_id: replaces, company_id: mgr.companyId, retired_by: mgr.userId });
    if (rErr && rErr.code !== "23505") console.error(`[topic-groups] retire on replace failed: ${rErr.message}`);
  }
  return NextResponse.json({ group: { id: data?.id ?? null, name, members, source, createdAt: data?.created_at ?? null } });
}

export async function DELETE(req: NextRequest) {
  const limited = rateLimit(req, { id: "topic-groups-write", windowMs: 60_000, max: 30 });
  if (limited) return limited;
  const mgr = await requireSalesCoachManager(req);
  if (!mgr) return NextResponse.json({ error: "Managers only." }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "Which group?" }, { status: 400 });
  const admin = createAdminClient();
  const { data: g, error: gErr } = await admin.from("market_topic_groups").select("id").eq("company_id", mgr.companyId).eq("id", id).maybeSingle();
  if (gErr && MISSING.has(String(gErr.code))) return NextResponse.json({ error: NOT_READY }, { status: 503 });
  if (gErr) return NextResponse.json({ error: "Couldn't find the group." }, { status: 500 });
  if (!g) return NextResponse.json({ error: "Group not found." }, { status: 404 });
  const { error } = await admin.from("market_topic_group_retirements").insert({ group_id: id, company_id: mgr.companyId, retired_by: mgr.userId });
  if (error && error.code !== "23505") {
    console.error(`[topic-groups] retire failed company=${mgr.companyId}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't ungroup." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
