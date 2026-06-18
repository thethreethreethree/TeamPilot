"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Activity, CheckCircle2, AlertTriangle, Lock } from "lucide-react";
import { createClient, supabaseEnabled } from "@/lib/supabase/client";

/**
 * /auth/recover — entry point for Supabase password recovery flows.
 *
 * Why this page exists
 * ────────────────────
 * Supabase's "send password recovery" emails a link to `/auth/v1/verify?
 * token=...&type=recovery&redirect_to=<configured_url>`. After Supabase
 * validates the token it redirects the browser to <configured_url> with
 * the access_token + refresh_token in the URL FRAGMENT (not query
 * string). Without a page that knows how to read that fragment, the
 * user lands on the dashboard root with no signal that they need to
 * set a new password. We've hit this multiple times now (the §1.7
 * audit's F2 item) — building the durable surface instead of patching.
 *
 * Flow:
 *   1. Page mounts. Reads URL fragment for #access_token + #type=recovery.
 *   2. Calls supabase.auth.setSession() with the recovered tokens. The
 *      user now has a temporary session scoped to this password reset.
 *   3. Shows a "set new password" form. Submits via
 *      supabase.auth.updateUser({ password }).
 *   4. On success, redirects to /dashboard.
 *
 * Configure your Supabase project to use THIS URL as the recovery
 * redirect:
 *   Authentication → URL Configuration → Site URL = the deployed origin
 *   Redirect URLs → add `<origin>/auth/recover` and
 *                       `http://localhost:4321/auth/recover`
 */

type Phase =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "submitting" }
  | { kind: "done" }
  | { kind: "error"; message: string };

export default function RecoverPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  // Track once-only token consumption so React 18 strict-mode double-mount
  // doesn't try to re-establish the session and double-trip the rate limit.
  const consumed = useRef(false);

  useEffect(() => {
    if (consumed.current) return;
    consumed.current = true;

    if (!supabaseEnabled) {
      setPhase({
        kind: "error",
        message:
          "Live mode required to recover a password. Demo mode has no auth.",
      });
      return;
    }

    // Supabase puts the tokens in the URL fragment (#access_token=...).
    // We must read window.location.hash on the client; SSR would return
    // an empty hash.
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const type = params.get("type");
    const errCode = params.get("error_code") ?? params.get("error");
    const errDesc = params.get("error_description");

    if (errCode) {
      setPhase({
        kind: "error",
        message:
          errDesc ??
          `Recovery link returned ${errCode}. The link may have expired or already been used.`,
      });
      return;
    }

    if (!accessToken || !refreshToken) {
      setPhase({
        kind: "error",
        message:
          "Recovery link is missing the auth tokens. Request a new recovery email and try again.",
      });
      return;
    }

    if (type && type !== "recovery") {
      // Other Supabase email flows (signup confirm, magiclink) would
      // also land here if mis-configured. Be explicit so the user
      // isn't shown a "set new password" form for a non-recovery flow.
      setPhase({
        kind: "error",
        message: `Expected a recovery link, got type=${type}. Use the link sent in the "reset password" email.`,
      });
      return;
    }

    const supabase = createClient();
    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          setPhase({ kind: "error", message: error.message });
          return;
        }
        // Clean the tokens out of the URL so a back/forward navigation
        // or sharing the URL doesn't expose the recovery session.
        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", window.location.pathname);
        }
        setPhase({ kind: "ready" });
      });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phase.kind !== "ready") return;
    if (password.length < 8) {
      setPhase({ kind: "error", message: "Password must be at least 8 characters." });
      return;
    }
    if (password !== confirm) {
      setPhase({ kind: "error", message: "Passwords don't match." });
      return;
    }
    setPhase({ kind: "submitting" });
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setPhase({ kind: "error", message: error.message });
      return;
    }
    setPhase({ kind: "done" });
    // Small delay so the user sees the success state before routing.
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-base flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FACC15] to-[#FDE047] flex items-center justify-center shadow-glow">
            <Activity className="w-4 h-4 text-white" aria-hidden />
          </div>
          <span className="text-lg font-bold text-primary">ELOSTATE</span>
        </div>

        <div className="glass-card p-8 fade-in">
          <div className="w-12 h-12 rounded-xl bg-[#FACC15]/10 border border-[#FACC15]/20 flex items-center justify-center mb-5">
            <Lock className="w-6 h-6 text-brand" aria-hidden />
          </div>

          {phase.kind === "loading" && (
            <>
              <h1 className="text-xl font-bold text-primary mb-1">
                Verifying recovery link…
              </h1>
              <p className="text-sm text-muted">
                One second while we exchange your recovery token.
              </p>
            </>
          )}

          {phase.kind === "ready" || phase.kind === "submitting" ? (
            <form onSubmit={submit}>
              <h1 className="text-xl font-bold text-primary mb-1">
                Set a new password
              </h1>
              <p className="text-sm text-muted mb-5">
                At least 8 characters. You&apos;ll be signed in automatically
                after saving.
              </p>
              <label className="block text-xs font-medium text-secondary mb-1.5">
                New password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                disabled={phase.kind === "submitting"}
                className="w-full bg-surface border border-default rounded-lg px-4 py-2.5 text-primary placeholder:text-muted focus:outline-none focus:border-[#FACC15]/50 focus:ring-1 focus:ring-[#FACC15]/30 transition-colors text-base mb-4"
                placeholder="••••••••"
                aria-label="New password"
              />
              <label className="block text-xs font-medium text-secondary mb-1.5">
                Confirm new password
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={phase.kind === "submitting"}
                className="w-full bg-surface border border-default rounded-lg px-4 py-2.5 text-primary placeholder:text-muted focus:outline-none focus:border-[#FACC15]/50 focus:ring-1 focus:ring-[#FACC15]/30 transition-colors text-base mb-5"
                placeholder="••••••••"
                aria-label="Confirm new password"
              />
              <button
                type="submit"
                disabled={phase.kind === "submitting" || !password || !confirm}
                className="w-full flex items-center justify-center gap-2 bg-[#FACC15] hover:bg-[#EAB308] disabled:opacity-50 disabled:cursor-not-allowed text-[#09090B] font-semibold px-6 py-2.5 rounded-lg transition-all text-sm"
              >
                {phase.kind === "submitting" ? "Saving…" : "Save new password"}
              </button>
            </form>
          ) : null}

          {phase.kind === "done" && (
            <>
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" aria-hidden />
                <h1 className="text-xl font-bold text-primary">
                  Password updated
                </h1>
              </div>
              <p className="text-sm text-muted">Redirecting to your dashboard…</p>
            </>
          )}

          {phase.kind === "error" && (
            <>
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-5 h-5 text-yellow-300" aria-hidden />
                <h1 className="text-xl font-bold text-primary">
                  Couldn&apos;t complete recovery
                </h1>
              </div>
              <p className="text-sm text-secondary leading-relaxed mb-5">
                {phase.message}
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm text-brand hover:text-primary"
              >
                ← Back to sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
