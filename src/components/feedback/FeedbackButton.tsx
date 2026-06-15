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

  return (
    <>
      <button
        type="button"
        onClick={click}
        aria-label="Send feedback"
        title="Send feedback"
        data-feedback-ignore
        className="fixed bottom-4 right-4 z-[60] flex items-center gap-1.5 bg-[#FACC15] hover:bg-[#EAB308] text-white text-xs font-semibold px-3 py-2 md:py-2.5 rounded-full shadow-glow transition-colors"
      >
        <MessageSquarePlus className="w-4 h-4" aria-hidden />
        Feedback
      </button>
      {open && <FeedbackPanel onClose={() => setOpen(false)} />}
    </>
  );
}
