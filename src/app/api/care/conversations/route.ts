import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { createCareConversation } from "@/lib/data/care";
import {
  resolveCareTenant,
  resolveCareTenantByEmbedToken,
} from "@/lib/care/config";

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

  const origin = req.headers.get("origin");
  const userAgent = req.headers.get("user-agent");

  let tenantId: string;
  let configOrigin = origin;
  // If the caller supplied an embed token, resolve through the
  // tenant registry — validate active + allowed_origins, log the
  // load event, reject if anything doesn't line up. Otherwise
  // fall back to the default (ELOSTATE itself).
  if (body.embedToken) {
    const resolution = await resolveCareTenantByEmbedToken({
      embedToken: body.embedToken,
      origin,
      userAgent,
    });
    if (!resolution.ok) {
      const status =
        resolution.reason === "origin_rejected"
          ? 403
          : resolution.reason === "tenant_inactive"
            ? 410
            : resolution.reason === "quota_exceeded"
              ? 429
              : 404;
      return NextResponse.json(
        {
          error:
            resolution.reason === "origin_rejected"
              ? "This origin is not authorized for this embed token."
              : resolution.reason === "tenant_inactive"
                ? "This C.A.R.E tenant is paused."
                : resolution.reason === "quota_exceeded"
                  ? "Conversation quota reached for this tenant."
                  : "Unknown embed token.",
        },
        { status }
      );
    }
    tenantId = resolution.companyId;
    configOrigin = origin;
  } else {
    tenantId = resolveCareTenant({ origin: origin ?? undefined });
  }

  const conversation = await createCareConversation({
    companyId: tenantId,
    source: body.embedToken ? "embedded_widget" : "web_widget",
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
    // Echo origin so the client can verify what we recorded
    origin: configOrigin,
  });
}
