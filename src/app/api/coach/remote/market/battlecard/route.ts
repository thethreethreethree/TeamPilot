import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { readBody } from "@/lib/api/validate";
import { askCoach } from "@/lib/coach/remote/askCoach";
import { callsNaming } from "@/lib/coach/remote/market";
import { BATTLECARD_INSTRUCTION } from "@/lib/coach/remote/battlecard";
import { readMarketInputs } from "@/lib/coach/remote/marketRead";

/**
 * POST /api/coach/remote/market/battlecard { competitor, module, days } → { answer, citations, calls } |
 * { answer: null, suppressed } (Engage plan E14; Gong F13.11 "create documents"). A battlecard for one competitor from the
 * newest calls (up to 10) in the asker's view that named it — the Market page's own read and grouping (marketRead,
 * callsNaming) — written by Ask Coach over those calls as the asker (each call opened with their access), every point
 * resting on cited lines. Not saved: written on request, so nothing new holds the customers' words.
 */
export const maxDuration = 60;

const Body = z.object({
  competitor: z.string().trim().min(1).max(80),
  module: z.enum(["remote_sales", "sales_coach"]).default("remote_sales"),
  days: z.union([z.literal(30), z.literal(90)]).default(90),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-ask", windowMs: 60_000, max: 20 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;
  const db = callerScopedDb(req) ?? (await createClient());
  const inputs = await readMarketInputs(db, body.module, body.days);
  if (!inputs.ok) {
    console.error(`[battlecard] ${inputs.what} read failed company=${ctx.companyId}: ${inputs.message}`);
    return NextResponse.json({ error: "Couldn't read the calls." }, { status: 500 });
  }
  const calls = callsNaming(inputs.calls, inputs.intel, body.competitor);
  if (!calls.length) return NextResponse.json({ error: `No call in view named ${body.competitor}.` }, { status: 404 });
  const r = await askCoach({ db, companyId: ctx.companyId, userId: ctx.userId, sessionIds: calls.map((c) => c.sessionId), question: BATTLECARD_INSTRUCTION(body.competitor), chatId: null, save: false, focus: [body.competitor] });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  if (r.suppressed) return NextResponse.json({ answer: null, suppressed: true });
  // Which call each cited line is on (date and label), through the caller's client — the chips and the copy name it.
  const cited = [...new Set(r.citations.map((c) => c.sessionId))];
  const { data: sess, error: lErr } = cited.length ? await db.from("coaching_sessions").select("id, client_label, started_at").in("id", cited) : { data: [], error: null };
  // Labels are a convenience: a failed read leaves the chips saying "call", logged rather than failing the card.
  if (lErr) console.error(`[battlecard] call labels read failed company=${ctx.companyId}: ${lErr.message}`);
  const labels = Object.fromEntries(((sess ?? []) as Array<{ id: string; client_label: string | null; started_at: string }>).map((s) => [String(s.id), `${s.started_at.slice(0, 10)}${s.client_label ? ` · ${s.client_label}` : ""}`]));
  return NextResponse.json({ answer: r.answer, citations: r.citations, calls: calls.length, labels });
}
