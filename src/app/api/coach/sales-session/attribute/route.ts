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
  // Proximity prior from loudness (salesperson wears the mic → louder).
  volumeHint: z.enum(["agent", "customer"]).optional(),
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
${
  body.volumeHint
    ? `\nACOUSTIC PRIOR: the salesperson wears the mic and is closer to it, so they are louder. The loudness of this utterance suggests the ${label(body.volumeHint)}. Treat this as a STRONG prior — agree with it unless the CONTENT clearly contradicts it.\n`
    : ""
}
Respond with ONLY this JSON: {"speaker":"salesperson"} or {"speaker":"prospect"}.`;

  const convo = (body.recentTurns ?? [])
    .map((t) => `${label(t.speaker)}: ${t.text}`)
    .join("\n");
  const user = `Recent conversation:\n${convo || "(start of conversation)"}\n\nLATEST utterance to label:\n"${body.latestText}"`;

  // Instrumented (diagnostic-logging-first): on a null result the caller
  // keeps its provisional label, so we surface WHY it was null — model
  // suppressed? empty product? unparseable output? — into the response so
  // it shows in the agent's console, not swallowed.
  let speaker: "agent" | "customer" | null = null;
  let raw = "";
  let suppressed = false;
  let err = "";
  const productFound = product !== "a product or service";
  try {
    const r = await classifyTurnSpeaker({ systemPrompt: system, userMessage: user });
    suppressed = r.suppressed;
    raw = (r.text ?? "").slice(0, 120);
    if (!r.suppressed && r.text) {
      const json = r.text.match(/\{[\s\S]*\}/)?.[0] ?? r.text;
      const parsed = JSON.parse(json) as { speaker?: string };
      const s = String(parsed?.speaker ?? "").toLowerCase();
      if (s.includes("prospect")) speaker = "customer";
      else if (s.includes("sales")) speaker = "agent";
    }
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }

  const debug = `suppressed=${suppressed} product=${productFound} err=${err || "none"} raw=${JSON.stringify(raw)}`;
  return NextResponse.json({ speaker, debug });
}
