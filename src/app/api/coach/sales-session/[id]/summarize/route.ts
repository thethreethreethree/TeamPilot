import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { generateCareReply } from "@/lib/claude";
import { getSession, getSessionTranscript } from "@/lib/data/salesCoach";

/**
 * POST /api/coach/sales-session/[id]/summarize
 *
 * Summarize feature on a session. Reuses the same LLM path C.A.R.E's
 * summarize uses (generateCareReply, §A21 — one engine, not a fork).
 * Per §A11 the summary surfaces FACTS (what was discussed, what the
 * customer wants/objects to, what was agreed, open items) — not a
 * verdict on the agent.
 */

const SUMMARY_SYSTEM = `You summarize a sales conversation transcript for the
agent who had it. Surface FACTS, not judgments (§A11): what was discussed,
what the customer said they want or objected to, what was agreed, and what
is still open. Be concise and concrete. Do NOT grade the agent or editorialize
— this is a factual recap they can act from. Plain prose, a few short
paragraphs or bullets. No preamble.`;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req, {
    id: "sales-session-summarize",
    windowMs: 60_000,
    max: 20,
  });
  if (limited) return limited;

  const { id } = await context.params;
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
  if (segments.length === 0) {
    return NextResponse.json(
      { error: "Nothing to summarize yet — no transcript." },
      { status: 400 }
    );
  }

  const transcript = segments
    .map((s) => `${s.speaker.toUpperCase()}: ${s.text}`)
    .join("\n");

  try {
    const r = await generateCareReply({
      companyId,
      systemPrompt: SUMMARY_SYSTEM,
      userMessage: `Transcript:\n${transcript}\n\nWrite the summary.`,
    });
    if (r.suppressed) {
      return NextResponse.json({ summary: null, suppressed: true });
    }
    return NextResponse.json({ summary: r.text.trim() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Summarize failed." },
      { status: 502 }
    );
  }
}
