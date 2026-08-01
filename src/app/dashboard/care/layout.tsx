import { CareShell } from "@/components/care/CareShell";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";

/**
 * Layout for every route under /dashboard/care/*.
 *
 * Replaces the default ELOSTATE dashboard sidebar with the Care
 * app shell (own left nav, own product brand, own sub-navigation).
 * The main ELOSTATE shell is still reachable via the "Back to
 * ELOSTATE" footer link in the Care sidebar.
 *
 * This separation matches how every leading support platform
 * (Zendesk, Intercom, Front, HelpScout) treats their product:
 * dedicated chrome, not a tab within a broader app.
 *
 * PRODUCT ACCESS GATE (2026-08-01 — completes the module-based access model, mirroring the sales-coach
 * layout gate, §A21). Only a C.A.R.E member (`is_support_agent`) OR a company admin (CEO/COO/admin) may
 * enter — the EXACT predicate `requireCareAgent` already enforces on every C.A.R.E API. So this changes NO
 * ONE's access: a non-care user's API calls already 403, they just saw a broken CareShell; now they're
 * redirected to /dashboard cleanly instead. Server-side (not a client redirect) so a non-member never sees
 * the shell flash — mirrors the parent dashboard + sales-coach layouts. Demo mode (no Supabase) bypasses.
 * (A care-provisioned pilot account is role='admin' from redeem_pilot_code, so it passes; the module-lock
 * middleware separately confines it to /dashboard/care.)
 */
export default async function CareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (supabaseEnabled) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, is_support_agent")
        .eq("id", user.id)
        .maybeSingle();
      const role = (profile?.role as string | null) ?? null;
      const isCompanyAdmin =
        role === "CEO" || role === "COO" || role === "admin";
      const isCareAgent = !!profile?.is_support_agent;
      if (!isCompanyAdmin && !isCareAgent) {
        redirect("/dashboard");
      }
    }
  }

  return <CareShell>{children}</CareShell>;
}
