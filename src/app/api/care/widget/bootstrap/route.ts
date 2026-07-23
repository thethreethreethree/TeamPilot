import { NextRequest, NextResponse } from "next/server";
import { resolveCareTenantByEmbedToken, toWidgetSafeConfig } from "@/lib/care/config";

/**
 * GET /api/care/widget/bootstrap?token=...
 *
 * Public, no auth. Called by the iframe widget page on load to
 * resolve its tenant + appearance config. The resolver also logs
 * the load event to care_widget_load_events so tenants and we can
 * see traffic + wrong-origin attempts.
 *
 * Returns only customer-safe fields — NEVER the embed_token,
 * NEVER allowed_origins, NEVER plan/quota internals. Those stay
 * server-side.
 */
export async function GET(req: NextRequest) {
  const token = (req.nextUrl.searchParams.get("token") ?? "").trim();
  const origin = req.headers.get("origin") ?? req.headers.get("referer") ?? null;
  const userAgent = req.headers.get("user-agent");

  if (!token) {
    return NextResponse.json(
      { error: "Missing embed token." },
      { status: 400 }
    );
  }
  // Audit finding: token was passed downstream without length
  // validation. Embed tokens are 32-char hex (UUID without
  // dashes) per care_tenant_config.embed_token default — anything
  // beyond 64 chars is malformed and would cause unnecessary DB
  // lookups. Bound the input.
  if (token.length > 64) {
    return NextResponse.json(
      { error: "Invalid embed token." },
      { status: 400 }
    );
  }

  const resolution = await resolveCareTenantByEmbedToken({
    embedToken: token,
    origin,
    userAgent,
  });

  if (!resolution.ok) {
    return NextResponse.json(
      { ok: false, reason: resolution.reason },
      { status: resolution.reason === "origin_rejected" ? 403 : 404 }
    );
  }

  // Only the widget-safe subset goes back — an explicit whitelist projection (toWidgetSafeConfig)
  // so no internal field (embed_token, allowedOrigins, plan, aiProductContext, …) can ever leak to
  // this unauthenticated endpoint, and a new CareTenantConfig field cannot silently appear here.
  // The projection is locked by config.widgetSafe.test.ts.
  return NextResponse.json({
    ok: true,
    widget: toWidgetSafeConfig(resolution.config),
  });
}
