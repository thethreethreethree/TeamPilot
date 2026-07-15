import type { Metadata } from "next";
import Sidebar from "@/components/layout/Sidebar";
import CommandPalette from "@/components/layout/CommandPalette";
import { ToastProvider } from "@/components/ui/toast";
import { LearningModeProvider } from "@/components/learning/LearningModeProvider";
import { ExperienceModeProvider } from "@/components/experience/ExperienceModeProvider";
import type { ExperienceMode } from "@/lib/experience/mode";
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
  // Read the experience dial SERVER-SIDE so the first paint already matches the
  // user's mode (audit F1 fix): the client provider previously defaulted to
  // 'standard' until a /api/me fetch resolved, so an Expert user's first render
  // flickered the simplified UI before correcting. Passing it as initialMode means
  // SSR and hydration both start from the real mode — no flicker, no hydration
  // mismatch, and "Expert exactly as-is" holds from the very first frame. Read from
  // the SAME profile query that already gates onboarding — no extra round-trip.
  let initialMode: ExperienceMode = "standard";
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
      .select("company_id, experience_mode")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile?.company_id) {
      redirect("/onboarding");
    }
    // Fail-safe to 'standard' (the never-over-serve default) if the column is
    // null/unreadable — mirrors getExperienceMode's posture exactly.
    initialMode = profile?.experience_mode === "expert" ? "expert" : "standard";
  }

  return (
    <ToastProvider>
      <LearningModeProvider>
       <ExperienceModeProvider initialMode={initialMode}>
        <div className="flex min-h-screen bg-base overflow-x-hidden">
          {/* Skip-to-content link for keyboard / screen-reader users.
              Hidden by default; appears in the top-left when focused
              via Tab so the user can jump past the sidebar nav. */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[100] focus:px-3 focus:py-2 focus:bg-ember-400 focus:text-[#09090B] focus:font-semibold focus:rounded-md focus:text-xs focus:shadow-glow"
          >
            Skip to main content
          </a>
          <Sidebar />
          {/* min-w-0 on <main> is the load-bearing guard against children
              (chat URLs, long table cells, etc.) pushing the page wider
              than the viewport. Combined with overflow-x-hidden it
              structurally prevents horizontal scroll on mobile. */}
          <main
            id="main-content"
            className="flex-1 md:ml-64 min-h-screen min-w-0 overflow-x-hidden"
          >
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
       </ExperienceModeProvider>
      </LearningModeProvider>
    </ToastProvider>
  );
}
