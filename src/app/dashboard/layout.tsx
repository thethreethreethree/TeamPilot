import Sidebar from "@/components/layout/Sidebar";
import CommandPalette from "@/components/layout/CommandPalette";
import { ToastProvider } from "@/components/ui/toast";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";

/**
 * Dashboard layout — server-side auth + onboarding gate.
 *
 * Why server-side (not a client `useEffect` redirect): a client redirect
 * would render the dashboard frame momentarily before kicking the user
 * to /login or /onboarding, which flashes empty state and looks broken.
 * Server-side `redirect()` prevents the half-render entirely.
 *
 * Demo mode bypasses the gate — there's no auth in demo mode, the
 * dashboard's demo branches still work, and forcing demo users through
 * /login or /onboarding would be hostile.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (supabaseEnabled) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      // Live mode without a session — send to /login.
      redirect("/login");
    }

    // Even with a session, the user might not have completed onboarding
    // (just signed up, no company yet). Redirect them through the flow.
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile?.company_id) {
      redirect("/onboarding");
    }
  }

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-base">
        <Sidebar />
        <main className="flex-1 ml-64 min-h-screen overflow-x-hidden">
          {children}
        </main>
        <CommandPalette />
      </div>
    </ToastProvider>
  );
}
