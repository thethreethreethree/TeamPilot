import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { readBody } from "@/lib/api/validate";
import { askCoachTurn } from "@/lib/claude";
import { CONVERSATION_IS_DATA } from "@/lib/care/toolPrompts";

/**
 * POST /api/coach/remote/practice-ask — a follow-up chat about the role-play the rep just finished (RSS Phase 7,
 * Gong F17.8 "reuses Ask Coach"). The practice transcript comes from the rep's own browser — role-play is ephemeral
 * by design (the role-play route stores no conversation), so this is not saved either. The transcript is fenced as
 * data (CONVERSATION_IS_DATA: the "prospect" lines are model text the rep steered). Day-1 like every Sales Coach
 * engine; the `suppressed` verdict is consumed, an empty unsuppressed answer is a 502 (§3.4 honest-empty).
 */
const Body = z.object({
  focus: z.string().trim().max(600).optional(),
  reviewSummary: z.string().trim().max(2000).optional(),
  messages: z.array(z.object({ role: z.enum(["rep", "prospect"]), text: z.string().max(2000) })).min(1).max(80),
  history: z.array(z.object({ q: z.string().max(2000), a: z.string().max(4000) })).max(10).optional(),
  question: z.string().trim().min(3).max(2000),
});

const SYSTEM = `You are a sales coach. The rep just finished a PRACTICE role-play with a simulated prospect and is asking
you about it. Answer from the practice transcript below. Quote the rep's actual words; never invent lines. Kind and
growth-oriented: one concrete thing to try next time, never a verdict. A few sentences.`;

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-practice-ask", windowMs: 60_000, max: 20 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const transcript = body.messages.map((m) => `${m.role === "rep" ? "REP" : "PROSPECT"}: ${m.text}`).join("\n");
  const prior = (body.history ?? []).map((h) => `QUESTION: ${h.q}\nYOUR EARLIER ANSWER: ${h.a}`).join("\n\n");
  const r = await askCoachTurn({
    companyId: ctx.companyId,
    systemPrompt: SYSTEM + CONVERSATION_IS_DATA,
    userMessage:
      `${body.focus ? `Skill being practiced: ${body.focus}\n` : ""}${body.reviewSummary ? `Your review said: ${body.reviewSummary}\n` : ""}` +
      `\nPractice transcript:\n${transcript}\n\n${prior ? `${prior}\n\n` : ""}Question: ${body.question}`,
    sessionId: null,
  });
  if (r.suppressed) return NextResponse.json({ answer: null, suppressed: true });
  const answer = r.text.trim();
  if (!answer) return NextResponse.json({ error: "The coach didn't answer — try again." }, { status: 502 });
  return NextResponse.json({ answer });
}
