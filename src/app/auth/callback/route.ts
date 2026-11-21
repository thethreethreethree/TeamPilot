import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/siteUrl";
import { safeNext } from "@/lib/auth/oauthProviders";

/**
 * GET /auth/callback — where Google / Microsoft sign-in returns (RSS Phase 9; Gong F1.2). Exchanges the one-time code
 * for a session (cookies set by the server client) and sends the person on. Every redirect is to the ONE canonical
 * origin (siteUrl), never this request's host, and only to a same-site path (safeNext) — see docs/AUTH-REDIRECTS.md.
 * A new person (no Elostate profile yet) lands on /dashboard, and the middleware sends them through onboarding as it
 * does for an email signup.
 */
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const code = sp.get("code");
  const next = safeNext(sp.get("next"));
  const back = (code: "oauth_cancelled" | "oauth_incomplete" | "oauth_failed") => NextResponse.redirect(`${siteUrl()}/login?error=${code}`);
  if (sp.get("error")) return back("oauth_cancelled");
  if (!code) return back("oauth_incomplete");
  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error(`[auth/callback] code exchange failed: ${error.message}`);
    return back("oauth_failed");
  }
  return NextResponse.redirect(`${siteUrl()}${next}`);
}
