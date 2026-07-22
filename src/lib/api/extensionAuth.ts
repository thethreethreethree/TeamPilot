import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getExtensionEntitlement,
  type ExtensionEntitlement,
} from "@/lib/care/extensionEntitlement";

/**
 * Auth + entitlement gate for the C.A.R.E browser-extension endpoints
 * (spec docs/feature-specs/CARE-BROWSER-EXTENSION.md, D2 + D3).
 *
 * The extension authenticates with a Supabase session token (from launchWebAuthFlow, D3), sent as a
 * `Authorization: Bearer <token>` header — NOT a cookie (MV3 extensions don't share the app's cookies).
 * The token is validated server-side; the tenant is resolved; then entitlement is checked. The SERVER is
 * the source of truth — a client that lies about its plan gets a 402 regardless (§ security: never trust
 * the client, same discipline as the app's RLS/authz layer).
 */

export type ExtensionUser = {
  userId: string;
  companyId: string;
  entitlement: ExtensionEntitlement;
};

export type ExtensionGateResult =
  | { ok: true; user: ExtensionUser }
  | { ok: false; response: NextResponse };

function unauth(message: string, status: number): { ok: false; response: NextResponse } {
  return { ok: false, response: NextResponse.json({ error: message }, { status }) };
}

/** Validate the Bearer token → resolve the tenant. Does NOT check entitlement (see requireEntitledExtensionUser). */
export async function requireExtensionAuth(req: NextRequest): Promise<
  { ok: true; userId: string; companyId: string } | { ok: false; response: NextResponse }
> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return unauth("Not authenticated.", 401);

  const admin = createAdminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return unauth("Invalid or expired session.", 401);

  const { data: profile } = await admin
    .from("profiles")
    .select("company_id")
    .eq("id", data.user.id)
    .maybeSingle();
  const companyId = (profile?.company_id as string | null) ?? null;
  if (!companyId) return unauth("No company associated with this account.", 403);

  return { ok: true, userId: data.user.id, companyId };
}

/**
 * Full gate: authenticate, then require the tenant be entitled (pro/enterprise or an active trial).
 * Returns a 402 (Payment Required) with the honest status if locked — so the extension can prompt to
 * start a trial or upgrade.
 */
export async function requireEntitledExtensionUser(req: NextRequest): Promise<ExtensionGateResult> {
  const auth = await requireExtensionAuth(req);
  if (!auth.ok) return auth;

  const entitlement = await getExtensionEntitlement(auth.companyId);
  if (entitlement.status === "locked") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Your plan doesn't include the C.A.R.E extension.", entitlement },
        { status: 402 }
      ),
    };
  }

  return { ok: true, user: { userId: auth.userId, companyId: auth.companyId, entitlement } };
}
