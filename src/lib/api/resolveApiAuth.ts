// resolveApiAuth.ts — PHASE-2 backend patch for the TeamPilot repo (NOT for the app).
// Drop at: src/lib/api/resolveApiAuth.ts  in c:\Users\johns\OneDrive\Documents\GitHub\TeamPilot
//
// PURPOSE: let the coach routes accept EITHER the web SSR cookie session OR a mobile `Authorization: Bearer
// <supabase access token>` — so the native app reuses the SAME routes (KPI compute, audio sign, session CRUD)
// with zero logic duplication. It mirrors the already-proven extension auth (src/lib/api/extensionAuth.ts:
// admin.auth.getUser(token)) but returns the SAME AuthContext shape the routes already consume from
// getCurrentAuthContext() — so a route swaps one line and gains mobile support without re-deriving anything
// (consume one verdict, don't fork the decision).
//
// USAGE in a route (e.g. src/app/api/coach/kpi/me/route.ts):
//     const ctx = await resolveApiAuth(req);          // was: getCurrentAuthContext()
//     if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
//     // ...unchanged: ctx.userId / ctx.companyId / ctx.isAdmin
//
// It tries the cookie first (web, unchanged behavior), then falls back to the Bearer header (mobile). Because it
// returns the identical AuthContext, every downstream branch — RLS-scoped queries, isAdmin gating, company
// scope — works untouched. No route logic is duplicated; only the identity resolution widens.

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAuthContext, type AuthContext } from "@/lib/supabase/auth-helpers";
import { isAdminRole } from "@/lib/roles";

/** Resolve the caller from the web cookie session OR a mobile Bearer token. Returns null if neither authenticates. */
export async function resolveApiAuth(req: Request): Promise<AuthContext | null> {
  // 1) Web path — the existing cookie session. Unchanged for every current caller.
  const cookieCtx = await getCurrentAuthContext();
  if (cookieCtx) return cookieCtx;

  // 2) Mobile path — a Bearer access token, validated exactly like the extension does.
  const header = req.headers.get("authorization") || "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;

  const admin = createAdminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;

  // Resolve the same profile fields getCurrentAuthContext resolves, so the returned shape is identical.
  const { data: profile } = await admin
    .from("profiles")
    .select("company_id, role, status")
    .eq("id", data.user.id)
    .maybeSingle();

  // Fail closed: no profile, or a removed account, is not authenticated (mirrors requireExtensionAuth).
  if (!profile || !profile.company_id || profile.status === "removed") return null;

  return {
    userId: data.user.id,
    companyId: profile.company_id as string,
    role: (profile.role as string | null) ?? null,
    isAdmin: isAdminRole(profile.role as string | null),
  };
}

/**
 * Just WHO the caller is — cookie session or mobile Bearer token — with no
 * company or role requirement.
 *
 * WHY THIS IS SEPARATE FROM resolveApiAuth. That one resolves a full
 * AuthContext and returns null without a profile carrying a company_id, which
 * is right for routes that gate on company or admin. Some routes never did:
 * /[id]/outcome only ever asked "is anyone signed in?" and left the access check
 * to RLS. Swapping it to resolveApiAuth would have started rejecting a signed-in
 * user with no company context — a real behavioural change to the WEB path,
 * introduced while adding mobile support, and caught only because that route's
 * existing tests began returning 401 instead of 200.
 *
 * So: identity only, and the route's own access check stays exactly as it was.
 */
export async function resolveApiUserId(req: Request): Promise<string | null> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth?.user) return auth.user.id;

  const header = req.headers.get("authorization") || "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;

  const admin = createAdminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;

  // Fail closed on a removed account, mirroring requireExtensionAuth. A profile
  // is NOT required here, because the cookie path never required one either.
  const { data: profile } = await admin
    .from("profiles")
    .select("status")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profile?.status === "removed") return null;

  return data.user.id;
}
