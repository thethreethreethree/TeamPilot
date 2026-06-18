import type { Metadata } from "next";
import Sidebar from "@/components/layout/Sidebar";
import CommandPalette from "@/components/layout/CommandPalette";
import { ToastProvider } from "@/components/ui/toast";
import { LearningModeProvider } from "@/components/learning/LearningModeProvider";
import { LearningModeFab } from "@/components/learning/LearningModeFab";
import { AskJeffPanel } from "@/components/learning/AskJeffPanel";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";

/**
 * Team Chat PWA install affordance — dashboard-wide.
 *
 * The dashboard layout overrides the root manifest with the team-chat
 * variant. This means every /dashboard/* page tells the browser the
 * installable app is "Team Chat" (focused chat-only PWA) rather than
 * the broader "ELOSTATE" PWA.
 *
 * Conscious tradeoff: pages like /dashboard/team, /dashboard/settings
 * also surface "Install Team Chat" in their browser install affordance.
 * This is aligned with the user's explicit decision that the focused
 * team-chat PWA is the primary install target. The root manifest still
 * applies to non-dashboard surfaces (/login, /onboarding, /pitch).
 *
 * The Apple PWA meta tags previously set on /dashboard/chats/layout.tsx
 * remain there — they apply to the chat subtree only, which is fine
 * because iOS reads them on the page where the user actually triggers
 * "Add to Home Screen".
 */
export const metadata: Metadata = {
  manifest: "/team-chat-manifest.webmanifest",
};

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
      <LearningModeProvider>
        <div className="flex min-h-screen bg-base overflow-x-hidden">
          <Sidebar />
          {/* min-w-0 on <main> is the load-bearing guard against children
              (chat URLs, long table cells, etc.) pushing the page wider
              than the viewport. Combined with overflow-x-hidden it
              structurally prevents horizontal scroll on mobile. */}
          <main className="flex-1 md:ml-64 min-h-screen min-w-0 overflow-x-hidden">
            {children}
          </main>
          <CommandPalette />
          {/* Lightbulb FAB — renders only when the user's preference is
              enabled AND the resolved theme is dark. The brand mark IS
              the FAB; clicking it illuminates the page. */}
          <LearningModeFab />
          {/* Ask Jeff slide-out — opens when a LearningHint's "Ask
              Jeff what this does" button is clicked. */}
          <AskJeffPanel />
        </div>
      </LearningModeProvider>
    </ToastProvider>
  );
}
