import { NextRequest, NextResponse } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { askCoach, listChats } from "@/lib/coach/remote/askCoach";

/**
 * /api/coach/remote/ask — Ask Coach across calls, and your saved chats (RSS Phase 6, Gong F13.8, F13.13; 0281).
 *   GET  ?sessionId= → { available, chats } — the caller's own chats that include this call.
 *   POST { sessionIds (1-10), question, chatId? } → { answer, chatId, citations } | { answer: null, suppressed }.
 * Every call is opened through the caller's client inside askCoach (RLS + the 0273 tree); sales calls only.
 */
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-ask-list", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const sessionId = new URL(req.url).searchParams.get("sessionId") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return NextResponse.json({ error: "Which call?" }, { status: 400 });
  return NextResponse.json(await listChats(ctx.companyId, ctx.userId, sessionId));
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-ask", windowMs: 60_000, max: 20 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  let body: { sessionIds?: unknown; question?: unknown; chatId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (question.length < 3 || question.length > 2000) return NextResponse.json({ error: "Ask a question (3 to 2000 characters)." }, { status: 400 });
  const sessionIds = Array.isArray(body.sessionIds) ? body.sessionIds.filter((x): x is string => typeof x === "string") : [];
  const chatId = typeof body.chatId === "string" ? body.chatId : null;
  if (!chatId && (sessionIds.length < 1 || sessionIds.length > 10)) return NextResponse.json({ error: "Ask about 1 to 10 calls." }, { status: 400 });

  const r = await askCoach({ db: callerScopedDb(req) ?? (await createClient()), companyId: ctx.companyId, userId: ctx.userId, sessionIds, question, chatId });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  if (r.suppressed) return NextResponse.json({ answer: null, suppressed: true });
  return NextResponse.json({ answer: r.answer, chatId: r.chatId, citations: r.citations });
}
