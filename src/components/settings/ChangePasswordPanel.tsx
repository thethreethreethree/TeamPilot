"use client";

import { useState } from "react";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { createClient, supabaseEnabled } from "@/lib/supabase/client";

/**
 * Change-password panel for /dashboard/settings.
 *
 * Why this exists
 * ───────────────
 * Before this, the only path to rotating a password was the Supabase
 * dashboard's "send recovery email" action plus the /auth/recover page.
 * That works for forgotten passwords but requires a round trip through
 * email for the routine case: "I'm signed in, I want to rotate my
 * password right now." This panel covers that case directly.
 *
 * It does NOT re-validate the old password — Supabase's updateUser
 * doesn't require it once the user has a session (the session is the
 * auth). The §1.7 audit identified this gap (F2 from Pass 3).
 *
 * Demo mode: panel is hidden via the parent's supabaseEnabled gate.
 */

export function ChangePasswordPanel() {
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "submitting" }
    | { kind: "ok" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state.kind === "submitting") return;
    if (next.length < 8) {
      setState({ kind: "error", message: "Password must be at least 8 characters." });
      return;
    }
    if (next !== confirm) {
      setState({ kind: "error", message: "Passwords don't match." });
      return;
    }
    setState({ kind: "submitting" });
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: next });
    if (error) {
      setState({ kind: "error", message: error.message });
      return;
    }
    setState({ kind: "ok" });
    setNext("");
    setConfirm("");
  };

  if (!supabaseEnabled) return null;

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-2 mb-1">
        <KeyRound className="w-4 h-4 text-brand" aria-hidden />
        <h2 className="text-sm font-semibold text-primary">Password</h2>
      </div>
      <p className="text-xs text-muted mb-5">
        Rotate your sign-in password. Takes effect immediately. You stay
        signed in on this device.
      </p>

      <form onSubmit={submit} className="space-y-3 max-w-sm">
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-muted mb-1.5">
            New password
          </label>
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            disabled={state.kind === "submitting"}
            placeholder="••••••••"
            className="w-full bg-surface border border-default rounded-lg px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-[#FACC15]/50 focus:ring-1 focus:ring-[#FACC15]/30 transition-colors"
            aria-label="New password"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-muted mb-1.5">
            Confirm
          </label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={state.kind === "submitting"}
            placeholder="••••••••"
            className="w-full bg-surface border border-default rounded-lg px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-[#FACC15]/50 focus:ring-1 focus:ring-[#FACC15]/30 transition-colors"
            aria-label="Confirm password"
          />
        </div>

        {state.kind === "error" && (
          <p className="text-xs text-red-400">{state.message}</p>
        )}
        {state.kind === "ok" && (
          <p className="flex items-center gap-1.5 text-xs text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden /> Password updated.
          </p>
        )}

        <button
          type="submit"
          disabled={state.kind === "submitting" || !next || !confirm}
          className="inline-flex items-center gap-2 bg-[#FACC15] hover:bg-[#EAB308] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          {state.kind === "submitting" ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> Updating…
            </>
          ) : (
            "Update password"
          )}
        </button>
      </form>
    </div>
  );
}
