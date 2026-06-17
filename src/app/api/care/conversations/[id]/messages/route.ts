import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import {
  getCareConversationByToken,
  listCareMessagesForCustomer,
  postCustomerMessage,
  postAiMessage,
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
} from "@/lib/care/prompt";
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
  return NextResponse.json({
    conversation: {
      id: conversation.id,
      status: conversation.status,
      aiResponding: conversation.aiResponding,
    },
    messages: messages.map(serializeMessage),
  });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const limited = rateLimit(req, {
    id: "care-messages-write",
    windowMs: 60_000,
    max: 30,
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
  if (conversation.status === "closed") {
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
    return NextResponse.json(
      {
        error: "Support is temporarily paused. We'll be back soon.",
        reason: "tenant_inactive",
      },
      { status: 410 }
    );
  }

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  // Persist the customer's message first so it lands on the chain
  // even if the AI call fails.
  const customerMsg = await postCustomerMessage({
    conversationId: conversation.id,
    body: body.body,
    medium: body.medium ?? "text",
  });
  if (!customerMsg) {
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
  const systemPrompt = buildCareSystemPrompt({ productContext });
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
    });
    aiText = r.text.trim();
  } catch (err) {
    if (err instanceof LlmError) {
      // Soft-fail: post a graceful handoff message instead of
      // showing an error to the customer. The widget surfaces this
      // as a normal AI reply so the conversation continues; the
      // agent inbox surfaces it as an open conversation.
      aiText =
        "I'm having trouble pulling up an answer right now — let me bring in a teammate who can help. They'll see everything we've talked about.";
      await markConversationHandedOff(conversation.id);
    } else {
      throw err;
    }
  }

  // If the AI emitted a hand-off signal, flip the conversation so
  // the next customer message doesn't trigger another AI reply.
  if (detectHandoffSignal(aiText)) {
    await markConversationHandedOff(conversation.id);
  }

  // Persist the AI reply.
  const aiMsg = await postAiMessage({
    conversationId: conversation.id,
    body: aiText,
  });

  const messages = await listCareMessagesForCustomer(conversation.id);
  return NextResponse.json({
    messages: messages.map(serializeMessage),
    aiReplied: !!aiMsg,
  });
}

function serializeMessage(m: SupportMessage) {
  return {
    id: m.id,
    authorType: m.authorType,
    body: m.body,
    createdAt: m.createdAt,
  };
}
