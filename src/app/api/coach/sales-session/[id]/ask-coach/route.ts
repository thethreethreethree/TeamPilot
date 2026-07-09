import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { generateCareReply } from "@/lib/claude";
import { getSession, getSessionTranscript } from "@/lib/data/salesCoach";

/**
 * POST /api/coach/sales-session/[id]/ask-coach
 *
 * Ask Coach on a session. The C.A.R.E ask-coach grades a DRAFT reply
 * before sending; a post-call session has no draft, so here it means:
 * the agent asks a free-form question about the conversation and gets
 * coaching grounded in the transcript + sales methodology. (Interpretation
 * surfaced in the build report — confirm it matches intent.)
 *
 * Obeys the tone law (§3.3/§3.4): kind, growth-oriented, specific to the
 * transcript, never a verdict. Reuses generateCareReply (§A21).
 */

const Body = z.object({
  question: z.string().min(3).max(2000),
});

const COACH_SYSTEM = `You are a sales coach. The agent has just finished a
live customer conversation and is asking you a question about it. Answer it
grounded in the TRANSCRIPT below and in sound sales methodology (discovery,
rapport, objection handling, pacing, closing).

Tone law: be kind and growth-oriented. Point to specific moments in the
transcript. If you suggest a different approach, frame it as an opportunity
with a concrete, practiceable next step — never a verdict. Keep it focused;
a few sentences, not an essay. Do not fabricate moments that aren't in the
transcript.`;

// LLM route: allow a longer LLM/stream budget than Vercel's short default (class-swept
// 2026-07-09 — 50e4ba1 declared maxDuration on finalize/summarize only; this closes the class).
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req, {
    id: "sales-session-ask-coach",
    windowMs: 60_000,
    max: 30,
  });
  if (limited) return limited;

  const { id } = await context.params;
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const companyId = (await getCurrentCompanyId()) ?? undefined;

  const session = await getSession(id);
  if (!session) {
    return NextResponse.json(
      { error: "Session not found or not accessible." },
      { status: 404 }
    );
  }
  const segments = await getSessionTranscript(id);
  // Audit F3 (2026-06-27): don't coach from nothing. With no transcript
  // the model would fabricate advice about a call it can't see (§3.4).
  if (segments.length === 0) {
    return NextResponse.json({
      answer:
        "There's no transcript on this session yet, so I can't coach from the call. Upload the recording (or add the transcript) first, then ask me anything about how it went.",
    });
  }
  const transcript = segments
    .map((s) => `${s.speaker.toUpperCase()}: ${s.text}`)
    .join("\n");

  try {
    const r = await generateCareReply({
      companyId,
      systemPrompt: COACH_SYSTEM,
      userMessage: `Transcript:\n${transcript}\n\nThe agent asks: ${body.question}\n\nCoach them.`,
      // Sales Coach runs day-1 — exempt from the §3.4 control window.
      controlExempt: true,
    });
    if (r.suppressed) {
      return NextResponse.json({ answer: null, suppressed: true });
    }
    return NextResponse.json({ answer: r.text.trim() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ask-coach failed." },
      { status: 502 }
    );
  }
}
