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
    .select("company_id, status")
    .eq("id", data.user.id)
    .maybeSingle();

  // Audit A2 (2026-07-22): match the app's own requireCareAgent — a REMOVED/deactivated user must not
  // reach a paid feature even with a lingering company_id. Fail closed.
  //
  // INVARIANT DEPENDENCY (2026-07-23 audit): this denylist ('removed' → block) is safe ONLY because
  // profiles.status is CHECK-constrained to exactly ('active','removed') in migration 0008 — so blocking
  // 'removed' is equivalent to allowlisting 'active'. If a status is EVER added to that CHECK (e.g.
  // 'suspended'), this gate AND requireCareAgent both silently FAIL OPEN (a suspended user is !== 'removed').
  // In that case flip BOTH to an allowlist (status === 'active') so a new status defaults to no-access.
  if ((profile?.status as string | null) === "removed") {
    return unauth("This account has been deactivated.", 403);
  }

  const companyId = (profile?.company_id as string | null) ?? null;
  if (!companyId) return unauth("No company associated with this account.", 403);

  return { ok: true, userId: data.user.id, companyId };
}

/**
 * Full gate: authenticate, then require the tenant be entitled (pro/enterprise or an active trial).
 * Returns a 402 (Payment Required) with the honest status if locked — so the extension can prompt to
 * start a trial or upgrade.
 */
export async function requireEntitledExtensionUser(
  req: NextRequest,
  opts?: { productLabel?: string }
): Promise<ExtensionGateResult> {
  // Product name shown in the 402 message. Defaults to "C.A.R.E extension" so every existing C.A.R.E caller
  // is byte-for-byte unchanged; the Sales Coach extension passes "Sales Coach extension" so a locked sales
  // user never sees C.A.R.E branding (§3.4 — the message must name the product the user is actually in). The
  // underlying entitlement SOURCE (shared vs a separate sales SKU) is a founder pricing decision; this label
  // is correct under either, because it only names the surface the caller is on.
  const productLabel = opts?.productLabel ?? "C.A.R.E extension";
  const auth = await requireExtensionAuth(req);
  if (!auth.ok) return auth;

  const entitlement = await getExtensionEntitlement(auth.companyId);
  if (entitlement.status === "locked") {
    // Honest error string that MATCHES entitlement.trialEnded, rather than a
    // fixed "plan doesn't include" that lies when the real reason is a trial
    // that ran out. The extension client already picks its own message from
    // entitlement.trialEnded; keeping the server string aligned means the two
    // can't drift, and any OTHER consumer (logs, debugging, a future client)
    // gets the true reason from the response itself — not only from a field it
    // has to know to inspect. (§3.4 — a response must not say something the
    // data contradicts.)
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: entitlement.trialEnded
            ? `Your 14-day ${productLabel} trial has ended.`
            : `Your plan doesn't include the ${productLabel}.`,
          entitlement,
        },
        { status: 402 }
      ),
    };
  }

  return { ok: true, user: { userId: auth.userId, companyId: auth.companyId, entitlement } };
}
