import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveCareTenantByEmbedToken } from "@/lib/care/config";
import { touchVisitorPresence } from "@/lib/data/care";

/**
 * POST /api/care/widget/presence
 *
 * Public, embed-token-authenticated (same resolver + origin check as
 * /api/care/widget/bootstrap). Called by the widget as an anonymous
 * heartbeat while it's mounted, so the tenant's Live Monitor can show
 * "who's on the site and what they're looking at."
 *
 * Anonymous by design (founder decision 2026-07-24): visitorId is a
 * random per-session id the widget generates — NOT a user id, NOT PII.
 * The write is best-effort (touchVisitorPresence swallows failures) so a
 * presence hiccup never degrades the actual chat.
 */
const Body = z.object({
  token: z.string().min(1).max(64),
  visitorId: z.string().min(1).max(64),
  page: z.string().max(512).nullish(),
  conversationId: z.string().uuid().nullish(),
});

export async function POST(req: NextRequest) {
  // Audit A1 (2026-07-24): every sibling public widget route (conversations-create, messages,
  // handoff) rate-limits; presence must too. Generous max because presence is a legitimate
  // heartbeat (~3/min per visitor) and many real visitors can share one NAT IP — this bounds a
  // flood (rotating visitorId) without blocking normal traffic. Matches the sibling pattern.
  const limited = rateLimit(req, {
    id: "care-widget-presence",
    windowMs: 60_000,
    max: 120,
  });
  if (limited) return limited;

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const origin =
    req.headers.get("origin") ?? req.headers.get("referer") ?? null;

  // Same tenant resolution + allowed-origin enforcement as bootstrap: a
  // presence heartbeat must not be a weaker door than the widget it rides on.
  const resolution = await resolveCareTenantByEmbedToken({
    embedToken: body.token,
    origin,
    userAgent: req.headers.get("user-agent"),
  });

  if (!resolution.ok) {
    return NextResponse.json(
      { ok: false, reason: resolution.reason },
      { status: resolution.reason === "origin_rejected" ? 403 : 404 }
    );
  }

  await touchVisitorPresence({
    companyId: resolution.companyId,
    visitorId: body.visitorId,
    page: body.page ?? null,
    conversationId: body.conversationId ?? null,
  });

  return NextResponse.json({ ok: true });
}
