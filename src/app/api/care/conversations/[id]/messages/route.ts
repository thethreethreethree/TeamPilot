import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import {
  getCareConversationByToken,
  listCareMessagesForCustomer,
  postCustomerMessage,
  postAiMessage,
  postSystemMessage,
  markConversationHandedOff,
  type SupportMessage,
} from "@/lib/data/care";
import {
  getCareTenantConfigByCompanyId,
  getProductContextForTenant,
} from "@/lib/care/config";
import {
  buildCareSystemPrompt,
  buildCareUserMessage,
  detectHandoffSignal,
  stripHandoffSentinel,
} from "@/lib/care/prompt";
import { HANDOFF_NOTICE } from "@/lib/care/handoverNotice";
import { generateCareReply } from "@/lib/claude";
import { LlmError } from "@/lib/llm/errors";

/**
 * Customer-side message endpoints for a single conversation.
 *
 * The session_token (from the conversation creation response) is
 * required on every request — passed as the `x-care-session` header
 * by the widget. We validate it server-side against the conversation
 * row before reading or writing.
 *
 *   GET  → return the visible message thread (no internal notes)
 *   POST → append a customer message, run AI response inline if
 *          ai_responding=true, return the AI reply (if any) + the
 *          updated message list
 *
 * The POST is intentionally synchronous — the customer waits for the
 * AI reply rather than polling. Keeps the widget UX simple.
 */

const Body = z.object({
  body: z.string().min(1).max(4000),
  /** Phase 9 voice — "voice" when the customer message came
   *  through the STT pipeline, otherwise omitted (defaults to
   *  "text" at the DB layer). */
  medium: z.enum(["text", "voice"]).optional(),
});

const VISIBLE_TURNS_IN_CONTEXT = 12;

function authedConversationId(req: NextRequest, paramsId: string) {
  return { paramsId, token: req.headers.get("x-care-session") };
}

// LLM route: allow a longer LLM/stream budget than Vercel's short default (class-swept
// 2026-07-09 — 50e4ba1 declared maxDuration on finalize/summarize only; this closes the class).
export const maxDuration = 60;

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const limited = rateLimit(req, {
    id: "care-messages-read",
    windowMs: 60_000,
    max: 60,
  });
  if (limited) return limited;

  const { token } = authedConversationId(req, id);
  if (!token) {
    return NextResponse.json(
      { error: "Missing session token." },
      { status: 401 }
    );
  }

  const conversation = await getCareConversationByToken(token);
  if (!conversation || conversation.id !== id) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const messages = await listCareMessagesForCustomer(conversation.id);
  const tenant = await getCareTenantConfigByCompanyId(conversation.companyId);
  return NextResponse.json({
    conversation: {
      id: conversation.id,
      status: conversation.status,
      aiResponding: conversation.aiResponding,
    },
    messages: messages.map(serializeMessage),
    // Persist the handoff card across reloads: needed once the conversation has been
    // handed to a human (aiResponding=false) AND the customer hasn't been captured yet.
    handoffCaptureNeeded: handoffCaptureNeeded(conversation),
    // The card uses this to pick the concern-topic list + whether to show order #.
    businessType: tenant?.businessType ?? "general",
  });
}

/**
 * Whether the widget should still show the handoff capture card: the conversation is in
 * a human-handled state (ai_responding=false — set only by a handoff or an agent claim)
 * and we haven't yet captured who the customer is. Once a topic or a linked customer
 * exists, stop nudging. Kept in one place so GET and POST agree.
 */
function handoffCaptureNeeded(c: {
  aiResponding: boolean;
  handoffTopic: string | null;
  customerId: string | null;
}): boolean {
  return !c.aiResponding && !(c.handoffTopic || c.customerId);
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Full audit of EVERY non-2xx path. The user reports Jeff
  // failing with "Couldn't send" despite LLM being verifiably
  // connected — meaning the failure is BEFORE the AI call.
  // Every guard below now logs the path it took with the
  // conversation id so Vercel function logs make the cause
  // obvious instead of "500 — somewhere".
  const { id } = await context.params;
  try {
    const limited = rateLimit(req, {
      id: "care-messages-write",
      windowMs: 60_000,
      max: 30,
    });
    if (limited) {
      // eslint-disable-next-line no-console
      console.warn(`[care.messages] 429 rate-limited id=${id}`);
      return limited;
    }

    const { token } = authedConversationId(req, id);
    if (!token) {
      // eslint-disable-next-line no-console
      console.warn(`[care.messages] 401 missing x-care-session id=${id}`);
      return NextResponse.json(
        { error: "Missing session token." },
        { status: 401 }
      );
    }

    const conversation = await getCareConversationByToken(token);
    if (!conversation || conversation.id !== id) {
      // eslint-disable-next-line no-console
      console.warn(
        `[care.messages] 404 conversation not found id=${id} tokenMatch=${conversation?.id === id}`
      );
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }
    if (conversation.status === "closed") {
      // eslint-disable-next-line no-console
      console.warn(`[care.messages] 410 conversation closed id=${id}`);
      return NextResponse.json(
        {
          error:
            "This conversation has been closed. Open a new one if you have another question.",
        },
        { status: 410 }
      );
    }

    // Honor the tenant's "paused" state even on existing
    // conversations. Without this, flipping active=false only
    // blocked NEW conversations — customers already mid-thread
    // could keep chatting indefinitely. "Paused" should mean
    // paused. 410 (Gone) is the right shape: same as a closed
    // conversation from the widget's perspective.
    const tenant = await getCareTenantConfigByCompanyId(conversation.companyId);
    if (tenant && !tenant.active) {
      // eslint-disable-next-line no-console
      console.warn(`[care.messages] 410 tenant inactive id=${id} companyId=${conversation.companyId}`);
      return NextResponse.json(
        {
          error: "Support is temporarily paused. We'll be back soon.",
          reason: "tenant_inactive",
        },
        { status: 410 }
      );
    }

    const body = await readBody(req, Body);
    if (body instanceof NextResponse) {
      // eslint-disable-next-line no-console
      console.warn(`[care.messages] 4xx body validation failed id=${id}`);
      return body;
    }

    // Persist the customer's message first so it lands on the chain
    // even if the AI call fails.
    const customerMsg = await postCustomerMessage({
      conversationId: conversation.id,
      body: body.body,
      medium: body.medium ?? "text",
    });
    if (!customerMsg) {
      // eslint-disable-next-line no-console
      console.error(
        `[care.messages] 500 postCustomerMessage returned null id=${id} (likely DB insert error — check support_messages schema/RLS)`
      );
      return NextResponse.json(
        { error: "Couldn't post the message. Please try again." },
        { status: 500 }
      );
    }

  // If the AI is no longer the first responder (an agent claimed
  // this conversation), don't generate a reply. The agent will
  // respond from the inbox. Return just the customer message.
  if (!conversation.aiResponding) {
    const messages = await listCareMessagesForCustomer(conversation.id);
    return NextResponse.json({
      messages: messages.map(serializeMessage),
      aiReplied: false,
      // Unambiguous "the AI no longer owns this thread" signal — the voice loop uses it to
      // stop re-arming and hand back to a human instead of replaying a stale AI line.
      aiResponding: false,
      handoffCaptureNeeded: handoffCaptureNeeded(conversation),
      businessType: tenant?.businessType ?? "general",
    });
  }

  // Generate the AI reply inline. Pull the visible thread so far
  // (capped to the last N turns) so the AI sees the full context
  // it has access to — including its own prior replies.
  const priorMessages = await listCareMessagesForCustomer(conversation.id);
  const recentTurns = priorMessages
    .slice(-VISIBLE_TURNS_IN_CONTEXT)
    // Filter out the just-inserted customer message — it goes in as
    // the newMessage field separately so the prompt is clean.
    .filter((m) => m.id !== customerMsg.id)
    .map((m) => ({
      role:
        m.authorType === "customer"
          ? ("customer" as const)
          : m.authorType === "agent"
            ? ("agent" as const)
            : ("ai" as const),
      body: m.body,
    }));

  const productContext = await getProductContextForTenant(conversation.companyId);
  const medium = body.medium ?? "text";
  // Per migration 0064: pass the per-tenant agent name. tenant is
  // already loaded above for the active-check. Falls back to 'Jeff'
  // if tenant config missing (e.g. ELOSTATE on bare deployment).
  const systemPrompt = buildCareSystemPrompt({
    productContext,
    medium,
    agentName: tenant?.aiName,
    // F2 (founder 2026-07-22): honour the per-tenant voice settings that were previously loaded but unused.
    aiTone: tenant?.aiTone,
    aiResponseLength: tenant?.aiResponseLength,
  });
  const userMessage = buildCareUserMessage({
    newMessage: body.body,
    context: { productContext, recentTurns },
  });

  let aiText = "";
  try {
    // No companyId passed — Care is not gated by §3.4 cycle.
    // Care is customer-facing and operates outside the team-coaching
    // measurement window.
    const r = await generateCareReply({
      systemPrompt,
      userMessage,
      medium,
    });
    aiText = r.text.trim();
  } catch (err) {
    // Soft-fail on ANY exception in the AI call — LlmError
    // (provider rejected, quota, network) OR a bare Error (env
    // misconfig like "No LLM provider configured" at startup,
    // unexpected throw inside provider lib). The customer's
    // message has already been saved (line 148); throwing here
    // would make the route return 500 and the widget show
    // "Couldn't send", convincing the customer their message
    // didn't land when it actually did.
    //
    // Better: post a graceful handoff and let the agent inbox
    // pick it up. The team sees the conversation immediately;
    // the customer sees a continuation, not a failure.
    //
    // eslint-disable-next-line no-console
    console.error(
      "[care.messages] AI reply failed, falling back to handoff:",
      err instanceof Error ? `${err.name}: ${err.message}` : err
    );
    aiText =
      err instanceof LlmError
        ? "I'm having trouble pulling up an answer right now — let me bring in a teammate who can help. They'll see everything we've talked about."
        : "Thanks — I'm pulling in a teammate to take this. They'll see everything you've shared and reply shortly.";
    await markConversationHandedOff(conversation.id);
  }

  // Detect the hand-off BEFORE stripping the sentinel (the sentinel IS the signal),
  // then strip it so the customer never sees the machine token in Jeff's message.
  const isHandoff = detectHandoffSignal(aiText);
  aiText = stripHandoffSentinel(aiText);

  if (isHandoff) {
    // Flip so the next customer message doesn't trigger another AI reply — the agent
    // owns it now (§3.3 — the AI actually cedes the thread when it says it will).
    await markConversationHandedOff(conversation.id);
  }

  // Persist the (sentinel-stripped) AI reply — but NEVER a blank bubble. If the model returned nothing
  // usable (an empty reply, or ONLY the sentinel → "" after strip), skip the post: on a handoff the notice
  // below still carries the message; otherwise `aiReplied:false` tells the widget the AI didn't answer.
  // This guards the empty-SUCCESS case (the reply-FAILED path above already handles errors). Safe because
  // aiMsg is only read as `!!aiMsg` (aiReplied). (hardening 2026-07-23)
  const aiMsg = aiText
    ? await postAiMessage({
        conversationId: conversation.id,
        body: aiText,
      })
    : null;

  // On hand-off, post the customer-facing notice AFTER Jeff's message so the thread
  // reads: Jeff's warm "bringing in a teammate" line, then the system notice. This is
  // requirement #1 — the customer is told a human is joining. Posted here (not inside
  // markConversationHandedOff) because the AI-reply fallback path above already handled
  // its own messaging; we only want the notice on a genuine in-band handoff.
  if (isHandoff) {
    await postSystemMessage({ conversationId: conversation.id, body: HANDOFF_NOTICE });
  }

    const messages = await listCareMessagesForCustomer(conversation.id);
    return NextResponse.json({
      messages: messages.map(serializeMessage),
      aiReplied: !!aiMsg,
      // Signal the widget to show the handoff capture card (requirement #2: capture
      // name/email/concern). Only on a fresh handoff this turn — not on every reply.
      handoff: isHandoff,
      // The AI's ownership AFTER this turn: false once it has handed off. The voice loop
      // reads this to play the (fresh) handoff line then end the call instead of looping.
      aiResponding: !isHandoff,
      businessType: tenant?.businessType ?? "general",
    });
  } catch (err) {
    // Top-level catch — surfaces any uncaught exception
    // (missing SUPABASE_SERVICE_ROLE_KEY, schema drift, foreign
    // key violation, anything). Without this Next.js returns
    // 500 with no body and the operator has no signal beyond
    // "the widget shows Couldn't send."
    const message =
      err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    // eslint-disable-next-line no-console
    console.error(
      `[care.messages] 500 uncaught exception id=${id}: ${message}`,
      err
    );
    return NextResponse.json(
      { error: "Server error.", detail: message },
      { status: 500 }
    );
  }
}

function serializeMessage(m: SupportMessage) {
  return {
    id: m.id,
    authorType: m.authorType,
    body: m.body,
    createdAt: m.createdAt,
    kind: m.kind,
    mediaUrl: m.mediaUrl,
    mediaType: m.mediaType,
  };
}
