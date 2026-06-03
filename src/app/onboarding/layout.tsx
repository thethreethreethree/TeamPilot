import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";

/**
 * Onboarding layout — inverse gate of the dashboard.
 *
 * Bounces a signed-in user with an existing company back to /dashboard so
 * the onboarding flow can't be re-entered accidentally (e.g. browser back
 * after completion). Bounces a signed-out user to /login so they can't
 * create a company without an auth identity to attach it to.
 *
 * Demo mode lets the page render — the demo route falls through to
 * /dashboard via the page's own router.push, no server gate needed.
 */
export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (supabaseEnabled) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.company_id) redirect("/dashboard");
  }
  return <>{children}</>;
}
