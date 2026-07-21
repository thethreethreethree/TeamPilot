import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import {
  getCareConversationByToken,
  captureHandoffDetails,
} from "@/lib/data/care";
import { getCareTenantConfigByCompanyId } from "@/lib/care/config";
import { findTopic } from "@/lib/care/handoverTopics";

/**
 * POST /api/care/conversations/[id]/handoff — the handoff capture card submit.
 *
 * The widget shows a compact card when Jeff hands the conversation to a human
 * (0188 requirement #2): full name · email · concern (topic dropdown) · order # for
 * e-commerce. EVERY field is OPTIONAL — the founder was explicit that capture must never
 * block the customer. This endpoint persists whatever was provided (upserts the customer,
 * links them to the conversation, stores the concern) and NEVER re-triggers the AI:
 * capturing details is not a message.
 *
 * Session-token authed like the messages route (x-care-session header). Scoped to the
 * one conversation the token owns; the topic is validated against THIS tenant's business
 * type so a spoofed value can't be stored.
 */

const Body = z.object({
  name: z.string().trim().max(200).optional(),
  // Optional email — accept a real address OR an empty string (the card lets them skip).
  email: z.union([z.string().trim().email().max(320), z.literal("")]).optional(),
  topic: z.string().trim().max(64).optional(),
  topicDetail: z.string().trim().max(2000).optional(),
  orderNumber: z.string().trim().max(120).optional(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const limited = rateLimit(req, {
    id: "care-handoff-capture",
    windowMs: 60_000,
    max: 15,
  });
  if (limited) return limited;

  const token = req.headers.get("x-care-session");
  if (!token) {
    return NextResponse.json({ error: "Missing session token." }, { status: 401 });
  }

  const conversation = await getCareConversationByToken(token);
  if (!conversation || conversation.id !== id) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  // Validate the concern topic against THIS tenant's business type — the widget picks
  // from handoverTopicsFor(businessType), so anything outside that set is drift or spoof.
  let topic: string | null = null;
  if (body.topic) {
    const tenant = await getCareTenantConfigByCompanyId(conversation.companyId);
    const businessType = tenant?.businessType ?? "general";
    const match = findTopic(businessType, body.topic);
    if (!match) {
      return NextResponse.json(
        { error: "Unrecognized concern for this business." },
        { status: 400 }
      );
    }
    topic = match.value;
  }

  const email = body.email && body.email.length > 0 ? body.email : null;

  const result = await captureHandoffDetails({
    conversationId: conversation.id,
    companyId: conversation.companyId,
    name: body.name ?? null,
    email,
    topic,
    topicDetail: body.topicDetail ?? null,
    orderNumber: body.orderNumber ?? null,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: "Couldn't save those details. Please try again." },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
