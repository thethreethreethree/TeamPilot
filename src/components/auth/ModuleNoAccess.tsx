"use client";

import { useState } from "react";
import { Activity, ShieldQuestion, RefreshCw, LogOut, Loader2 } from "lucide-react";
import { createClient, supabaseEnabled } from "@/lib/supabase/client";

/**
 * Honest "no access yet" terminal for a MODULE-LOCKED account that is not (yet) a member of its module.
 *
 * Why this screen instead of a redirect
 * ─────────────────────────────────────
 * A single-module (pilot-locked) account cannot reach the ELOSTATE hub — the middleware bounces `/dashboard`
 * back into its module. So the module layout cannot resolve a non-member by redirecting to `/dashboard`: that
 * loops forever (`ERR_TOO_MANY_REDIRECTS`) and bricks a freshly-invited rep before their admin assigns a role.
 * Instead the layout HOLDS here — a terminal, in-module page that tells the user the truth (access isn't
 * assigned yet) and gives them the two real actions: re-check (an admin may have just assigned it) or sign out.
 */
export function ModuleNoAccess({ module }: { module: "sales_coach" | "care" }) {
  const [signingOut, setSigningOut] = useState(false);

  const label = module === "sales_coach" ? "Sales Coach" : "C.A.R.E";

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      if (supabaseEnabled) {
        const supabase = createClient();
        await supabase.auth.signOut();
      }
    } finally {
      // Full navigation (not router.push) so the auth cookies are re-read from scratch on the login page.
      window.location.href = "/login";
    }
  };

  return (
    <div className="min-h-screen bg-base flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-ember-400 to-[#FDE047] flex items-center justify-center shadow-glow">
            <Activity className="w-4 h-4 text-white" aria-hidden />
          </div>
          <span className="text-lg font-bold text-primary">ELOSTATE</span>
        </div>

        <div className="glass-card p-8 fade-in">
          <div className="w-12 h-12 rounded-xl bg-ember-400/10 border border-ember-400/20 flex items-center justify-center mb-5">
            <ShieldQuestion className="w-6 h-6 text-brand" aria-hidden />
          </div>

          <h1 className="text-xl font-bold text-primary mb-1">Access not set up yet</h1>
          <p className="text-sm text-secondary leading-relaxed mb-5">
            Your account is on the {label} plan, but you haven&apos;t been given {label} access yet. Ask your
            admin to assign your role — once they do, use Re-check below and you&apos;ll be in.
          </p>

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full flex items-center justify-center gap-2 bg-ember-400 hover:bg-ember-500 text-[#09090B] font-semibold px-6 py-2.5 rounded-lg transition-all text-sm"
            >
              <RefreshCw className="w-4 h-4" aria-hidden /> Re-check access
            </button>
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              className="w-full flex items-center justify-center gap-2 bg-surface border border-default hover:border-ember-400/40 text-secondary hover:text-primary px-6 py-2.5 rounded-lg transition-colors text-sm disabled:opacity-50"
            >
              {signingOut ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Signing out…
                </>
              ) : (
                <>
                  <LogOut className="w-4 h-4" aria-hidden /> Sign out
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
