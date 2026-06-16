import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { createCareConversation } from "@/lib/data/care";
import { resolveCareTenant } from "@/lib/care/config";

/**
 * POST /api/care/conversations
 *
 * Customer-side endpoint — no auth required. Creates a new support
 * conversation and returns the conversation id + session_token. The
 * widget stores the session_token in localStorage and uses it for
 * every subsequent request as its bearer.
 *
 * Tenant resolution: Sprint 1 always uses the default tenant
 * (ELOSTATE). Sprint 3 will accept an embed token and route to the
 * white-label customer's tenant.
 *
 * Rate-limited (10/min/IP) since this is a public unauthenticated
 * endpoint. Real-world traffic should be well under this; the limit
 * is anti-abuse not anti-customer.
 */

const Body = z.object({
  subject: z.string().max(400).optional(),
  embedToken: z.string().max(200).optional(),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "care-conversations-create",
    windowMs: 60_000,
    max: 10,
  });
  if (limited) return limited;

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const tenantId = resolveCareTenant({
    origin: req.headers.get("origin") ?? undefined,
    embedToken: body.embedToken,
  });

  const conversation = await createCareConversation({
    companyId: tenantId,
    subject: body.subject,
  });
  if (!conversation) {
    return NextResponse.json(
      { error: "Couldn't open a conversation. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    conversationId: conversation.id,
    sessionToken: conversation.sessionToken,
  });
}
