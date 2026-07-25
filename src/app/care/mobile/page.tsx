import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CareRadialHome } from "@/components/care/mobile/CareRadialHome";

/**
 * Mobile C.A.R.E — radial home (founder 2026-07-25).
 *
 * Deliberately OUTSIDE /dashboard/care so it does NOT get wrapped in the desktop
 * CareShell (that layout renders its own fixed full-screen shell — nesting the
 * radial inside it would double-stack two full-screen surfaces). This route is
 * its own full-screen mobile surface.
 *
 * Auth: page-level gate here (redirect unauthenticated to /login); the data is
 * additionally protected because every /api/care/agent/* route the radial calls
 * runs requireCareAgent. Reachability (A31): the entry URL is /care/mobile —
 * follow-up is auto-routing small screens here or adding a nav affordance.
 */
export const metadata = {
  title: "C.A.R.E — Mobile",
};

export default async function CareMobilePage() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");
  return <CareRadialHome />;
}
