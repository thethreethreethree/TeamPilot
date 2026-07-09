import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import { generateCareReply } from "@/lib/claude";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { LlmError } from "@/lib/llm/errors";

/**
 * POST /api/me/ask-jeff
 *
 * Conversational follow-up inside Learning Mode. The user is reading
 * a structured hint about a feature and has a question the hint
 * didn't answer. Jeff (the ELOSTATE teaching voice) reads the hint's
 * full context and the user's question, then explains.
 *
 * Per CLAUDE.md §3.3 — Jeff TEACHES, never overtakes. He explains
 * what the feature does and why it was designed that way. He never
 * tells the user what to click next or what decision to make.
 *
 * Per CLAUDE.md §3.4 — Brain-gated. During the month-1 control
 * window Jeff still teaches (this is documentation, not strategic
 * guidance) but the channel routes through the same Brain pipeline
 * so the §3.4 discipline is consistent end-to-end. If the gate is
 * suppressed, the response is the honest "Learning is in §3.4
 * control window" message rather than a fallback non-Brain call.
 */

const TurnSchema = z.object({
  role: z.enum(["user", "jeff"]),
  content: z.string().min(1).max(4000),
});

const Body = z
  .object({
    featureContext: z.object({
      title: z.string().max(200),
      whatItIs: z.string().max(2000),
      why: z.string().max(2000),
      how: z.string().max(2000),
      principle: z.string().max(2000).optional(),
      category: z.string().max(100).optional(),
    }),
    history: z.array(TurnSchema).max(12).default([]),
    userQuestion: z.string().min(1).max(2000),
  })
  .strict();

const SYSTEM_PROMPT = `You are Jeff — ELOSTATE's teaching voice inside Learning Mode. A user is reading a structured hint about a feature in the product and has a follow-up question. Your job is to teach them more deeply about THIS specific feature — what it is, why it exists, how to use it well, and the discipline it embodies.

Operating rules (these are non-negotiable):

1. TEACH, DO NOT DIRECT.
   You explain what the feature does and why it was designed that way. You do not tell the user what to click next, what they "should" do, or what decision to make. Their judgment is theirs.

2. STAY ON THIS FEATURE.
   The user clicked Ask Jeff on a specific feature. Their question is about that feature unless they explicitly pivot. Don't drift into product overview territory.

3. RESPECT THE STRUCTURE THEY ALREADY READ.
   The hint they were reading covered four things: WHAT IT IS, WHY IT EXISTS, HOW TO USE IT, and (often) a transferable principle. Don't repeat that verbatim. Add depth: examples, edge cases, comparisons to similar features, the failure modes the feature was built to defeat.

4. SHORT BY DEFAULT, LONG IF EARNED.
   Most questions deserve 2-4 sentences. If the question genuinely needs depth (an example walkthrough, a comparison, a counterexample), go longer. Never pad.

5. CONNECT TO THE DISCIPLINE.
   Every ELOSTATE feature exists because of a problem-solving discipline (the System refuses to assert before the user has reasoned, refuses to claim outcomes it hasn't measured, refuses to forget the reasoning behind decisions). Where your answer can illuminate that discipline naturally, do so. Don't shoehorn it.

6. ACKNOWLEDGE WHAT YOU DON'T KNOW.
   If the user asks something the feature context doesn't cover and you'd be guessing, say so. "The hint I'm working from doesn't cover that — here's what I can say with confidence, and here's what you'd want to verify with a teammate or in the surface itself."

7. NEVER OVERSELL.
   No marketing language. No "you'll love this." Calm, declarative, direct. The product earns the user's trust by being honest, including about its own limits.

Output format: plain prose, no markdown headers, no bullet points unless a comparison genuinely needs them. Write as a thoughtful peer.`;

// LLM route: allow a longer LLM/stream budget than Vercel's short default (class-swept
// 2026-07-09 — 50e4ba1 declared maxDuration on finalize/summarize only; this closes the class).
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "ask-jeff",
    windowMs: 60_000,
    max: 30,
  });
  if (limited) return limited;

  // Auth gate (audit 2026-07-09): require a signed-in user before the LLM call — an
  // anon caller otherwise drives the model on our bill (middleware doesn't cover
  // /api/*; getCurrentCompanyId returns null, not an error, for anon).
  const _authClient = await createClient();
  const { data: _authData } = await _authClient.auth.getUser();
  if (!_authData?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  // Brain-gated: pass companyId so §3.4 applies. If they're in the
  // control window, the call returns suppressed and the panel
  // surfaces the honest "Learning is in control window" message.
  const companyId = (await getCurrentCompanyId()) ?? undefined;

  const ctx = body.featureContext;
  const historyBlock = body.history.length
    ? body.history
        .map((t) => `${t.role === "user" ? "User" : "Jeff"}: ${t.content}`)
        .join("\n\n")
    : "(no prior turns in this session)";

  const userMessage = [
    `Feature the user is reading about:`,
    `Title: ${ctx.title}`,
    ctx.category ? `Category: ${ctx.category}` : null,
    ``,
    `What it is (the hint says): ${ctx.whatItIs}`,
    `Why it exists (the hint says): ${ctx.why}`,
    `How to use it (the hint says): ${ctx.how}`,
    ctx.principle ? `Principle to remember: ${ctx.principle}` : null,
    ``,
    `Prior turns in this conversation:`,
    historyBlock,
    ``,
    `User's current question: ${body.userQuestion}`,
    ``,
    `Answer the question. Teach them more deeply about THIS feature.`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const r = await generateCareReply({
      companyId,
      systemPrompt: SYSTEM_PROMPT,
      userMessage,
    });
    if (r.suppressed) {
      return NextResponse.json(
        {
          suppressed: true,
          reason: r.reason,
          answer:
            "Learning Mode's conversational layer is in §3.4 control window — the System refuses to speak strategically during the month-1 baseline. The structured hint above this conversation still covers what / why / how. Come back to ask follow-ups once the control window has passed.",
        },
        { status: 200 }
      );
    }
    return NextResponse.json({ answer: r.text.trim() });
  } catch (err) {
    if (err instanceof LlmError) {
      return NextResponse.json(
        { error: err.message, kind: err.kind },
        { status: err.status ?? 502 }
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't reach Jeff." },
      { status: 500 }
    );
  }
}
