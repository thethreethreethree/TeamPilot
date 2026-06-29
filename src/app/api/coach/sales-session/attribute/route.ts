import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { classifyTurnSpeaker } from "@/lib/claude";

/**
 * POST /api/coach/sales-session/attribute (Live Sales Coach — Increment 2)
 *
 * Content-based speaker attribution for ONE turn: given the recent
 * conversation + the latest utterance, label it salesperson (agent) or
 * prospect (customer) by CONTENT, not voice (founder's hard constraint).
 * Product-aware — it knows what this company sells.
 *
 * Returns { speaker: "agent" | "customer" | null }. On ANY failure
 * (parse, suppression, model error) it returns null, and the caller keeps
 * its provisional alternation label — attribution degrades, the loop never
 * breaks (§3.4).
 */
const Body = z.object({
  latestText: z.string().min(1).max(2000),
  priorSpeaker: z.enum(["agent", "customer", "unknown"]).optional(),
  recentTurns: z
    .array(
      z.object({
        speaker: z.enum(["agent", "customer", "unknown"]),
        text: z.string().max(2000),
      })
    )
    .max(12)
    .optional(),
});

function label(s: "agent" | "customer" | "unknown" | undefined): string {
  return s === "customer"
    ? "prospect"
    : s === "agent"
      ? "salesperson"
      : "unknown";
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "sales-coach-attribute",
    windowMs: 60_000,
    max: 240,
  });
  if (limited) return limited;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  // The product-aware signal: what is this company selling?
  let product = "a product or service";
  const companyId = await getCurrentCompanyId();
  if (companyId) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("care_tenant_config")
      .select("ai_product_context")
      .eq("company_id", companyId)
      .maybeSingle();
    const p = (data?.ai_product_context as string | null)?.trim();
    if (p) product = p.slice(0, 1200);
  }

  const system = `You label who is speaking in a LIVE sales conversation, by CONTENT, not by voice.

The SALESPERSON is selling: ${product}

SALESPERSON markers: pitches or describes that offering, asks discovery questions, handles objections, proposes next steps, speaks as "we/our".
PROSPECT markers: asks about price/terms/fit, describes THEIR own situation or needs, raises concerns or objections, "how does it…", "what about…".

The previous utterance was the ${label(body.priorSpeaker)}. Speakers usually alternate, but NOT always — one person can take two turns in a row, and short backchannels ("mhm", "right") happen. Use CONTENT as the decider; alternation is only a weak tiebreaker.

Respond with ONLY this JSON: {"speaker":"salesperson"} or {"speaker":"prospect"}.`;

  const convo = (body.recentTurns ?? [])
    .map((t) => `${label(t.speaker)}: ${t.text}`)
    .join("\n");
  const user = `Recent conversation:\n${convo || "(start of conversation)"}\n\nLATEST utterance to label:\n"${body.latestText}"`;

  let speaker: "agent" | "customer" | null = null;
  try {
    const r = await classifyTurnSpeaker({ systemPrompt: system, userMessage: user });
    if (!r.suppressed && r.text) {
      const json = r.text.match(/\{[\s\S]*\}/)?.[0] ?? r.text;
      const parsed = JSON.parse(json) as { speaker?: string };
      const s = String(parsed?.speaker ?? "").toLowerCase();
      if (s.includes("prospect")) speaker = "customer";
      else if (s.includes("sales")) speaker = "agent";
    }
  } catch {
    // null → caller keeps its provisional label.
  }

  return NextResponse.json({ speaker });
}
