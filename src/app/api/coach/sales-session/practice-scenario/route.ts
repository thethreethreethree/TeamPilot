import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { CONVERSATION_IS_DATA } from "@/lib/care/toolPrompts";
import { getCurrentSalesCorpus } from "@/lib/data/salesCoach";
import { dissectCoachV5 } from "@/lib/claude";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import {
  buildScenarioSystemPrompt,
  buildScenarioUserMessage,
  parsePracticeScenario,
} from "@/lib/coach/v5/practiceScenario";

/**
 * POST /api/coach/sales-session/practice-scenario — generate ONE realistic practice scenario for a rep's focus skill
 * (founder 2026-08-27). Any authenticated rep (self-serve practice). Reuses dissectCoachV5 + the company corpus, the
 * same LLM path as the roleplay/review. §3.4: on a malformed/empty generation we return {scenario:null} and the client
 * falls back to the plain focus seed — never a fabricated scenario.
 */

const Body = z.object({ focus: z.string().trim().min(1).max(600) });

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "coach-practice-scenario", windowMs: 60_000, max: 20 });
  if (limited) return limited;

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data: profile } = await sb.from("profiles").select("company_id").eq("id", auth.user.id).maybeSingle();
  const companyId = (profile?.company_id as string | null) ?? null;
  if (!companyId) return NextResponse.json({ error: "No company context." }, { status: 403 });

  const corpus = await getCurrentSalesCorpus(companyId).catch(() => null);
  const r = await dissectCoachV5({
    companyId,
    systemPrompt: buildScenarioSystemPrompt(corpus?.content) + CONVERSATION_IS_DATA,
    userMessage: buildScenarioUserMessage(body.focus),
  });
  // Honest fallback: null scenario (not an error) so the client uses the plain focus seed.
  return NextResponse.json({ scenario: parsePracticeScenario(r.text) });
}
