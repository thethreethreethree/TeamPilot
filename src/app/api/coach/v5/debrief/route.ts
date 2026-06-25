import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { generateConversationDebrief } from "@/lib/coach/v5/debrief";

/**
 * POST /api/coach/v5/debrief
 *
 * End-of-conversation Coach debrief (§3.6 make-learning-visible).
 * Called when a conversation ends — a Team Chat topic is closed, or a
 * C.A.R.E conversation is resolved. Returns the two-part teaching
 * debrief for the CURRENT user's own messages in that conversation.
 *
 * Generated fresh from the user's authored messages + grades + cross-
 * conversation memory (see src/lib/coach/v5/debrief.ts). Non-blocking
 * by contract: the caller fires this AFTER the close/resolve action
 * succeeds, so a debrief failure can never stall the workflow. On any
 * failure the engine returns the empty state and this route returns it
 * with 200 — the UI renders "nothing to flag".
 *
 * Idempotency / cost: each call is one LLM generation. The client
 * should call it once per close, not on every render of a closed
 * conversation; the emitted coach.debrief_generated chain event is the
 * durable record a future surface can read back without re-generating.
 *
 * Rate limit: 20/min/user — closes are infrequent; this is abuse
 * protection, not a steady-state throttle.
 */

const BodySchema = z.object({
  surface: z.enum(["chat_topic", "support_conversation"]),
  conversationId: z.string().uuid(),
});

/**
 * GET /api/coach/v5/debrief?surface=…&conversationId=…
 *
 * Read-back of the most recent stored debrief for a conversation,
 * without regenerating (no LLM cost). Used when re-opening an
 * already-closed conversation so the debrief the user saw at close
 * time is shown again. Returns { debrief: null } if none was stored.
 */
export async function GET(req: NextRequest) {
  const surface = req.nextUrl.searchParams.get("surface");
  const conversationId = req.nextUrl.searchParams.get("conversationId");
  if (
    (surface !== "chat_topic" && surface !== "support_conversation") ||
    !conversationId
  ) {
    return NextResponse.json({ error: "Bad params." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // Latest stored debrief authored by THIS user for THIS conversation.
  // RLS scopes events to the company; actor narrows to the user's own.
  const { data } = await supabase
    .from("events")
    .select("payload")
    .eq("actor", auth.user.id)
    .eq("kind", "coach.debrief_generated")
    .eq("subject", `${surface}:${conversationId}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.payload) {
    return NextResponse.json({ debrief: null });
  }
  const p = data.payload as Record<string, unknown>;
  return NextResponse.json({
    debrief: {
      hasSignal: true,
      learned: Array.isArray(p.learned) ? p.learned : [],
      workOn: Array.isArray(p.work_on) ? p.work_on : [],
      closing: typeof p.closing === "string" ? p.closing : undefined,
    },
  });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "coach-v5-debrief",
    windowMs: 60_000,
    max: 20,
  });
  if (limited) return limited;

  const body = await readBody(req, BodySchema);
  if (body instanceof NextResponse) return body;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const companyId = (await getCurrentCompanyId()) ?? undefined;
  if (!companyId) {
    return NextResponse.json(
      { error: "No company context." },
      { status: 403 }
    );
  }

  // The engine reads the conversation via RLS-scoped clients
  // (fetchMessages / fetchAgentConversation), so a user can only
  // debrief conversations they're already allowed to read. No extra
  // authorization needed here — RLS is the gate.
  const debrief = await generateConversationDebrief({
    surface: body.surface,
    conversationId: body.conversationId,
    userId: auth.user.id,
    companyId,
  });

  // Emit the chain event so the learning is visible + durable (§3.1
  // append-only, §3.6 make-learning-visible). Best-effort — never
  // blocks the response. Stores only the structured debrief, never raw
  // grade counts. Subject mirrors the grade-sent convention so a future
  // "your growth over time" surface can roll debriefs up per surface.
  if (debrief.hasSignal) {
    try {
      await supabase.from("events").insert({
        company_id: companyId,
        actor: auth.user.id,
        kind: "coach.debrief_generated",
        subject: `${body.surface}:${body.conversationId}`,
        payload: {
          surface: body.surface,
          learned_count: debrief.learned.length,
          work_on_count: debrief.workOn.length,
          learned: debrief.learned,
          work_on: debrief.workOn,
          closing: debrief.closing ?? null,
          coach_version: "v5.0",
        },
      });
    } catch {
      /* event emit is best-effort; the debrief still returns */
    }
  }

  return NextResponse.json({ debrief });
}
