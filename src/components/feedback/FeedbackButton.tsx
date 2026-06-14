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

  // On chat detail pages the bottom-right floats over the composer's
  // Send button area, blocking "Help me formulate" and the send
  // affordance on mobile. Reposition to top-right and use
  // safe-area-inset-top so the button sits BELOW the iOS status bar /
  // dynamic island instead of crashing into them. Detection is path-
  // based so this is purely a chat-detail tweak — every other surface
  // keeps the standard bottom-right placement.
  const isChatDetailPage = /^\/dashboard\/chats\/[^/]+$/.test(pathname);

  // For chat detail: top-right using safe-area-inset-top.
  // env(safe-area-inset-top) returns the status bar height in iOS
  // PWA standalone, 0 elsewhere. The +0.5rem floor keeps a small
  // visual gap on Android / desktop where the inset is zero.
  const chatPageStyle: React.CSSProperties = {
    top: "calc(env(safe-area-inset-top, 0px) + 0.5rem)",
    right: "0.75rem",
  };

  return (
    <>
      <button
        type="button"
        onClick={click}
        aria-label="Send feedback"
        title="Send feedback"
        data-feedback-ignore
        style={isChatDetailPage ? chatPageStyle : undefined}
        className={`fixed ${
          isChatDetailPage ? "" : "bottom-4 right-4"
        } z-[60] flex items-center gap-1.5 bg-[#FACC15] hover:bg-[#EAB308] text-white text-xs font-semibold px-3 py-2 md:py-2.5 rounded-full shadow-glow transition-colors`}
      >
        <MessageSquarePlus className="w-4 h-4" aria-hidden />
        Feedback
      </button>
      {open && <FeedbackPanel onClose={() => setOpen(false)} />}
    </>
  );
}
