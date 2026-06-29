import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { SalesCoachShell } from "@/components/sales-coach/SalesCoachShell";

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
  if (supabaseEnabled) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, sales_coach_role")
        .eq("id", user.id)
        .maybeSingle();
      const role = (profile?.role as string | null) ?? null;
      const isCompanyAdmin =
        role === "CEO" || role === "COO" || role === "admin";
      const hasSalesCoachRole = !!profile?.sales_coach_role;
      if (!isCompanyAdmin && !hasSalesCoachRole) {
        redirect("/dashboard");
      }
    }
  }

  return <SalesCoachShell>{children}</SalesCoachShell>;
}
