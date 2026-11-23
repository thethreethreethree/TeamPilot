import { NextRequest, NextResponse } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { askPipeline } from "@/lib/coach/remote/askPipeline";

export const maxDuration = 60;

/**
 * POST /api/coach/remote/ask-pipeline { question, scope: "mine" | "team" | <repId> } — Ask Coach across a pipeline
 * (2026-11-23). Read through the caller's client: "team" is every prospect RLS lets the caller see (a manager's tree),
 * a rep id is one report's pipeline (RLS answers nothing for someone the caller can't see).
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-ask-pipeline", windowMs: 60_000, max: 10 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  let body: { question?: unknown; scope?: unknown; today?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (question.length < 3 || question.length > 1000) return NextResponse.json({ error: "Ask a question (3 to 1000 characters)." }, { status: 400 });
  const scope = typeof body.scope === "string" ? body.scope : "mine";
  if (scope !== "mine" && scope !== "team" && !UUID.test(scope)) return NextResponse.json({ error: "Whose pipeline?" }, { status: 400 });
  const repId = scope === "mine" ? ctx.userId : scope === "team" ? undefined : scope;
  // The viewer's calendar day, so "overdue" matches what their Pipeline screen shows; the server's UTC day otherwise.
  const today = typeof (body as { today?: unknown }).today === "string" && /^\d{4}-\d{2}-\d{2}$/.test((body as { today: string }).today) ? (body as { today: string }).today : undefined;

  const r = await askPipeline({ db: callerScopedDb(req) ?? (await createClient()), companyId: ctx.companyId, repId, question, today });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  if (r.suppressed) return NextResponse.json({ answer: null, suppressed: true });
  return NextResponse.json({ answer: r.answer, citations: r.citations, prospects: r.prospects, capped: r.capped });
}
