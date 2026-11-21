import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { lockFromPilotModule, moduleGateDecision } from "@/lib/auth/moduleAccess";
import { isSalesCoachMember } from "@/lib/coach/v5/skillAccess";
import { ModuleNoAccess } from "@/components/auth/ModuleNoAccess";
import { RemoteSalesShell } from "@/components/remote-sales/RemoteSalesShell";

/**
 * Remote Sales — the home of the RSS build (docs/rss: phone and video sales calls, coaching loop, search and
 * library, trackers, training, protection). Same access decision as the Sales Coach layout (membership + the 0207
 * module lock, moduleGateDecision), so a non-member never reaches it and a locked non-member is held, not looped.
 * Its own shell: the plan's sections as one module, not the old Sales Coach pages.
 */
export default async function RemoteSalesLayout({ children }: { children: React.ReactNode }) {
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
      const member = isSalesCoachMember({
        role: (profile?.role as string | null) ?? null,
        sales_coach_role: (profile?.sales_coach_role as string | null) ?? null,
        company_id: null,
      });
      const company = (profile?.companies ?? null) as { access_module?: string | null } | null;
      const gate = moduleGateDecision(member, !!lockFromPilotModule(company?.access_module ?? null));
      if (gate === "hub") redirect("/dashboard");
      if (gate === "hold") return <ModuleNoAccess module="sales_coach" />;
    }
  }
  return <RemoteSalesShell>{children}</RemoteSalesShell>;
}
