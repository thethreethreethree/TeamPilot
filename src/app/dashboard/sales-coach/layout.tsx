import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { SalesCoachShell } from "@/components/sales-coach/SalesCoachShell";
import { lockFromPilotModule, moduleGateDecision } from "@/lib/auth/moduleAccess";
import { isSalesCoachMember } from "@/lib/coach/v5/skillAccess";
import { ModuleNoAccess } from "@/components/auth/ModuleNoAccess";

// Sales Coach gets its OWN installable PWA identity (founder 2026-07-04):
// installing from any Sales Coach page uses this manifest — name "Sales Coach",
// its own icon, launching straight into the coach. Overrides the app-wide
// ELOSTATE manifest for these routes.
export const metadata: Metadata = {
  manifest: "/sales-coach.webmanifest",
  applicationName: "Sales Coach",
  appleWebApp: {
    capable: true,
    title: "Sales Coach",
    statusBarStyle: "black-translucent",
  },
  // PNG apple-touch-icon — iOS reliably renders PNG for the home-screen icon
  // (SVG support is version-dependent); audit F1. Rendered from the SVG.
  icons: { apple: "/sales-coach-apple.png" },
};

/**
 * Layout for every route under /dashboard/sales-coach/*.
 *
 * Wraps them in the Sales Coach product shell (§A21, mirrors CareShell),
 * AND enforces the product ACCESS GATE (founder choice 2026-06-28): only
 * a Sales Coach member (sales_coach_role admin|staff) OR a company admin
 * (CEO/COO/admin, the bootstrap) may enter. Everyone else is redirected
 * to /dashboard.
 *
 * Server-side gate (not a client redirect) so a non-member never sees
 * the shell flash — mirrors the parent dashboard layout's auth gate.
 * Demo mode (no Supabase) bypasses the gate, like the rest of the app.
 */
export default async function SalesCoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Module hard-lock (0207): a single-module account can't return to the ELOSTATE hub (the middleware bounces
  // it), so hide the shell's "Back to ELOSTATE" link for it. Resolved server-side + passed to the shell.
  let locked = false;
  if (supabaseEnabled) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, sales_coach_role, companies(access_module)")
        .eq("id", user.id)
        .maybeSingle();
      // Access gate: a Sales-Coach member (admin|staff) OR a company leader may enter. The predicate is the
      // pure, tested `isSalesCoachMember` (NOT inlined) so a future weakening fails CI — mirrors how the
      // /dashboard/care gate routes through `deriveCareAccess`. It is deliberately WIDER than
      // `isSalesCoachManager`: a staff rep is a member and must reach their own coaching area.
      const member = isSalesCoachMember({
        role: (profile?.role as string | null) ?? null,
        sales_coach_role: (profile?.sales_coach_role as string | null) ?? null,
        company_id: null,
      });
      const company = (profile?.companies ?? null) as { access_module?: string | null } | null;
      const lockedBool = !!lockFromPilotModule(company?.access_module ?? null);
      // A LOCKED non-member must HOLD on an honest in-module screen — redirecting to /dashboard loops forever
      // via the middleware module-lock (ERR_TOO_MANY_REDIRECTS), bricking a freshly-invited rep before role
      // assignment. A non-locked non-member is safely sent to the hub. (moduleGateDecision is pure + tested.)
      const gate = moduleGateDecision(member, lockedBool);
      if (gate === "hub") redirect("/dashboard");
      if (gate === "hold") return <ModuleNoAccess module="sales_coach" />;
      locked = lockedBool;
    }
  }

  return <SalesCoachShell locked={locked}>{children}</SalesCoachShell>;
}
