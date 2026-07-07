import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { generateCareReply } from "@/lib/claude";
import { askCoachSystemPrompt } from "@/lib/dissect/engine";

/**
 * POST /api/dissect/ask-coach
 *
 * Ask Coach on a pasted conversation. Obeys §3.3 (guide-don't-overtake): if the
 * user has NOT shared how they'd solve it (userHypothesis empty), the coach's
 * first move is to ask what they think before asserting; if they HAVE, it builds
 * on their thinking with the WHY. Grounded in the pasted conversation (§3.4 — no
 * fabrication). EPHEMERAL — the client passes the conversation + current problem
 * statement back each turn; nothing is stored server-side.
 *
 * Composes on generateCareReply — the same coach-reply path the Sales Coach
 * ask-coach uses (§A16), reframed from sales to problem-solving.
 */

const Body = z.object({
  content: z.string().min(1).max(20000),
  question: z.string().min(2).max(2000),
  /** The user's own thinking on how to solve it, if they've offered it (§3.3). */
  userHypothesis: z.string().max(4000).optional(),
  /** The diagnosed problem statement, echoed from the client's ephemeral state. */
  problemStatement: z.string().max(1000).optional(),
  /** Prior turns of THIS ephemeral thread, so the coach has conversation memory
   *  (generateCareReply is single-shot; we pass the transcript in the message).
   *  Without this the §3.3 dialogue loops — the coach re-asks "what do you think?"
   *  because it never sees that the user already answered. */
  history: z
    .array(
      z.object({
        role: z.enum(["user", "coach"]),
        text: z.string().max(6000),
      })
    )
    .max(40)
    .optional(),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "dissect-ask-coach",
    windowMs: 60_000,
    max: 30,
  });
  if (limited) return limited;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const userHypothesis = (body.userHypothesis ?? "").trim();
  const history = body.history ?? [];

  // §3.3: the coach asks for the user's view FIRST, then builds on it. The user
  // has "shared their thinking" if they filled the hypothesis box OR they've
  // already spoken at least once in this thread (answering the coach's opening
  // question counts). Deriving it only from the box was the loop bug — the coach
  // kept re-asking after the user had plainly answered.
  const userHasSharedTheirThinking =
    userHypothesis.length > 0 || history.some((t) => t.role === "user");

  const systemPrompt = askCoachSystemPrompt({
    sourceText: body.content,
    problemStatement: body.problemStatement?.trim() || null,
    userHasSharedTheirThinking,
  });

  // Give the coach the conversation so far (generateCareReply is single-shot, so
  // the transcript rides in the message). Prior turns + the user's stated thinking
  // + the current question.
  const transcript = history
    .map((t) => `${t.role === "user" ? "User" : "Coach"}: ${t.text}`)
    .join("\n");
  const parts: string[] = [];
  if (transcript) parts.push(`Conversation so far:\n${transcript}`);
  if (userHypothesis) parts.push(`How the user is thinking about it: ${userHypothesis}`);
  parts.push(`User's new message: ${body.question}`);
  const userMessage = parts.join("\n\n");

  const companyId = (await getCurrentCompanyId()) ?? undefined;
  let reply: string;
  try {
    const r = await generateCareReply({
      companyId,
      systemPrompt,
      userMessage,
    });
    reply = r.text;
  } catch {
    return NextResponse.json(
      { error: "The coach could not respond just now. Please try again." },
      { status: 502 }
    );
  }

  if (!reply || !reply.trim()) {
    return NextResponse.json(
      { error: "The coach could not respond just now. Please try again." },
      { status: 502 }
    );
  }

  return NextResponse.json({ reply });
}
