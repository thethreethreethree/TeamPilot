import { NextRequest, NextResponse } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { topicGroupCoach } from "@/lib/claude";
import { CONVERSATION_IS_DATA } from "@/lib/care/toolPrompts";
import { computeMarket } from "@/lib/coach/remote/market";
import { readMarketInputs, readTopicGroups } from "@/lib/coach/remote/marketRead";
import { candidates, parseSuggestions, suggestionPrompt, TOPIC_GROUP_SYSTEM } from "@/lib/coach/remote/topicSuggest";

export const maxDuration = 60;

/**
 * POST /api/coach/remote/market/topic-groups/suggest { module } (managers) — the AI proposes topic groups from the topics
 * on the manager's calls in the last 90 days (2026-11-23; founder picker "AI suggests, manager OKs"). Returns suggestions
 * only; nothing is stored until the manager accepts one (POST topic-groups). Only topics on 2+ calls and not already
 * grouped are sent, and a suggestion survives only if every member is one of them (topicSuggest.parseSuggestions).
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "topic-groups-suggest", windowMs: 60_000, max: 5 });
  if (limited) return limited;
  const mgr = await requireSalesCoachManager(req);
  if (!mgr) return NextResponse.json({ error: "Managers only." }, { status: 403 });
  let b: { module?: unknown } = {};
  try {
    b = await req.json();
  } catch {
    /* no body: Remote Sales */
  }
  const callModule = b.module === "sales_coach" ? "sales_coach" : "remote_sales";
  const db = callerScopedDb(req) ?? (await createClient());
  const [inputs, groups] = await Promise.all([readMarketInputs(db, callModule, 90), readTopicGroups(db, mgr.companyId)]);
  if (!inputs.ok || !groups.ok) {
    console.error(`[topic-suggest] read failed company=${mgr.companyId}`);
    return NextResponse.json({ error: "Couldn't read the topics — try again." }, { status: 500 });
  }
  const given = candidates(computeMarket(inputs.calls, inputs.intel, 10_000, groups.groups).topics);
  if (given.length < 2) return NextResponse.json({ suggestions: [], offered: given.length });
  const r = await topicGroupCoach({ companyId: mgr.companyId, systemPrompt: TOPIC_GROUP_SYSTEM + CONVERSATION_IS_DATA, userMessage: suggestionPrompt(given) });
  if (r.suppressed) return NextResponse.json({ suggestions: [], offered: given.length, suppressed: true });
  const suggestions = parseSuggestions(r.text, given);
  if (!suggestions) return NextResponse.json({ error: "The suggestions came back unreadable. Try again." }, { status: 502 });
  const callsOf = new Map(given.map((g) => [g.name, g.calls]));
  return NextResponse.json({ offered: given.length, suggestions: suggestions.map((s) => ({ ...s, counts: s.members.map((m) => callsOf.get(m) ?? 0) })) });
}
