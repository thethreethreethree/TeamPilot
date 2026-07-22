"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MessageSquarePlus } from "lucide-react";
import { createClient, supabaseEnabled } from "@/lib/supabase/client";
import { FeedbackPanel } from "./FeedbackPanel";

/**
 * FeedbackButton — floating action button visible on every page.
 *
 * Behavior per the user's choices:
 *   - On every dashboard / authed page: click → opens the slide-out
 *     panel with full context capture.
 *   - On public pages (landing, login, pitch, onboarding before
 *     completion): click → routes to /login with `from=` so the
 *     tester lands back here after signing in. The button itself
 *     stays visible everywhere.
 *
 * The button sits bottom-right at z-[60] so it floats above page
 * content but below the toast viewport (z-[60] in toast.tsx) and any
 * modal (z-[80] in this project's modals). The `data-feedback-ignore`
 * attribute tells the html2canvas screenshot path to skip the button
 * itself so the captured image looks like what the user sees.
 */
export function FeedbackButton() {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);

  // Track auth state so we know which path the click should take.
  useEffect(() => {
    if (!supabaseEnabled) {
      setAuthed(false);
      return;
    }
    const supabase = createClient();
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setAuthed(!!data.user);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!cancelled) setAuthed(!!session?.user);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const click = () => {
    if (authed) {
      setOpen(true);
      return;
    }
    // Public-page route: send to login with a return target so they
    // come back to this page and can submit feedback in-context.
    const from = encodeURIComponent(pathname);
    router.push(`/login?from=${from}&intent=feedback`);
  };

  // On chat detail pages we suppress the floating button entirely
  // and let the page render an inline Feedback chip in the topic
  // header row. Reason (§A8): Feedback is the user talking to the
  // System — it belongs with the other System chips (Add member,
  // Summarize, Coach, etc.), not floating over content. Every prior
  // position (bottom-right → composer, top-right → status bar /
  // topic-chip row) collided with something. The inline chip never
  // overlaps because it lives in the same scrollable surface as the
  // other System affordances.
  const isChatDetailPage = /^\/dashboard\/chats\/[^/]+$/.test(pathname);
  if (isChatDetailPage) return null;

  // On any other authed dashboard route the Sidebar's Testing
  // section already renders an inline "Send feedback" entry — the
  // floating button would be a duplicate covering page content.
  // Per the user's direct request: "move the feedback button to
  // the testing field." Suppress the floating button on
  // /dashboard/* routes; the Sidebar entry IS the access point.
  const isDashboardRoute = pathname.startsWith("/dashboard");
  if (isDashboardRoute) return null;

  // /widget/* is the customer-facing embedded Care widget, rendered on a third party's site. The
  // global Feedback button must NOT leak into it — it routes to ELOSTATE's /login, which a customer's
  // end-user should never see (audit V5 2026-07-22). It can't escape the root layout, so suppress here.
  if (pathname.startsWith("/widget")) return null;

  // On the landing page the top-right nav now renders an inline
  // "Feedback" link next to Sign in / Request access per user
  // request ("please move this button up in here"). The floating
  // button would duplicate it AND cover content alongside the
  // Care chat widget. Suppress it; the inline nav link is the
  // access point.
  const isLandingPage = pathname === "/";
  if (isLandingPage) return null;

  return (
    <>
      <button
        type="button"
        onClick={click}
        aria-label="Send feedback"
        title="Send feedback"
        data-feedback-ignore
        /* right-20 (80px from edge) leaves room for the Care chat
           widget at right-4 (16px + 56px bubble = ends at 72px, plus
           an 8px gap = right-20). Keeps both visible per the
           user's "Care next to Feedback" placement. */
        // mb-[env(safe-area-inset-bottom)] shifts up by the iPhone
        // gesture bar height so the button is reliably tappable on
        // newer iOS devices.
        className="fixed bottom-4 right-20 z-[60] flex items-center gap-1.5 bg-ember-400 hover:bg-ember-500 text-[#09090B] text-xs font-semibold px-3 py-2 md:py-2.5 rounded-full shadow-glow transition-colors mb-[env(safe-area-inset-bottom)]"
      >
        <MessageSquarePlus className="w-4 h-4" aria-hidden />
        Feedback
      </button>
      {open && <FeedbackPanel onClose={() => setOpen(false)} />}
    </>
  );
}
