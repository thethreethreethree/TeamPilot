"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient, supabaseEnabled } from "@/lib/supabase/client";
import { Activity, CheckCircle2, Loader2, ArrowRight } from "lucide-react";

/**
 * /invite/[code] — accept-invitation surface.
 *
 * Flow:
 *  - Unauthenticated user: show sign-in/sign-up form. After auth, accept the code.
 *  - Authenticated user: prompt to accept; on accept, redirect to /dashboard.
 *  - Demo mode: explain that invitations require live mode.
 */
export default function InviteAcceptPage() {
  const router = useRouter();
  const { code } = useParams<{ code: string }>();
  const [phase, setPhase] = useState<"loading" | "needs-auth" | "ready" | "done" | "error">(
    "loading"
  );
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabaseEnabled) {
      setPhase("error");
      setError(
        "Demo mode — invitations require a live Supabase project. Configure keys in .env.local."
      );
      return;
    }
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setPhase("ready");
      } else {
        setPhase("needs-auth");
      }
    })();
  }, []);

  const handleAuthAndAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const supabase = createClient();
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) {
          throw new Error(
            "Check your email to confirm your account, then come back to accept the invitation."
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      await acceptInvitation();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
      setBusy(false);
    }
  };

  const acceptInvitation = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/team/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, fullName: fullName || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Accept failed.");
      setPhase("done");
      setTimeout(() => router.push("/dashboard"), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Accept failed.");
      setPhase("ready");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-base flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-ember-400 to-[#FDE047] flex items-center justify-center shadow-glow">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <span className="text-xl font-bold text-primary">ELOSTATE</span>
        </div>

        <div className="glass-card p-8">
          {phase === "loading" && (
            <div className="flex items-center gap-2 text-sm text-secondary justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          )}

          {phase === "error" && (
            <>
              <h1 className="text-lg font-semibold text-primary mb-2">
                Can&apos;t accept this invitation
              </h1>
              <p className="text-sm text-red-300">{error}</p>
            </>
          )}

          {phase === "needs-auth" && (
            <>
              <h1 className="text-lg font-semibold text-primary mb-1">
                You&apos;ve been invited to ELOSTATE
              </h1>
              <p className="text-sm text-secondary mb-6">
                {mode === "signup"
                  ? "Create your account to join."
                  : "Sign in to join."}
              </p>
              <form onSubmit={handleAuthAndAccept} className="space-y-3">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full bg-surface border border-default rounded-lg px-3.5 py-2.5 text-sm text-primary focus:outline-none focus:border-ember-400/50"
                />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full bg-surface border border-default rounded-lg px-3.5 py-2.5 text-sm text-primary focus:outline-none focus:border-ember-400/50"
                />
                {mode === "signup" && (
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your name (optional)"
                    className="w-full bg-surface border border-default rounded-lg px-3.5 py-2.5 text-sm text-primary focus:outline-none focus:border-ember-400/50"
                  />
                )}
                {error && <p className="text-xs text-red-400">{error}</p>}
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full flex items-center justify-center gap-2 bg-ember-400 hover:bg-ember-500 disabled:opacity-40 text-[#09090B] font-semibold py-2.5 rounded-lg transition-all text-sm"
                >
                  {busy
                    ? "Please wait…"
                    : mode === "signup"
                    ? "Create account & accept"
                    : "Sign in & accept"}
                  {!busy && <ArrowRight className="w-4 h-4" />}
                </button>
              </form>
              <p className="text-center text-xs text-muted mt-4">
                {mode === "signup" ? "Already have an account? " : "Need an account? "}
                <button
                  onClick={() => {
                    setMode(mode === "signup" ? "signin" : "signup");
                    setError("");
                  }}
                  className="text-brand hover:text-primary"
                >
                  {mode === "signup" ? "Sign in instead" : "Sign up instead"}
                </button>
              </p>
            </>
          )}

          {phase === "ready" && (
            <>
              <h1 className="text-lg font-semibold text-primary mb-1">
                Accept invitation
              </h1>
              <p className="text-sm text-secondary mb-5">
                You&apos;re signed in. Confirm to attach this account to the inviting
                company.
              </p>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name (optional, used in team views)"
                className="w-full bg-surface border border-default rounded-lg px-3.5 py-2.5 text-sm text-primary focus:outline-none focus:border-ember-400/50 mb-3"
              />
              {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
              <button
                onClick={acceptInvitation}
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 bg-ember-400 hover:bg-ember-500 disabled:opacity-40 text-[#09090B] font-semibold py-2.5 rounded-lg transition-all text-sm"
              >
                {busy ? "Accepting…" : "Accept invitation"}
                {!busy && <ArrowRight className="w-4 h-4" />}
              </button>
            </>
          )}

          {phase === "done" && (
            <div className="text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <p className="text-sm text-primary mb-1">Welcome to the team.</p>
              <p className="text-xs text-muted">Redirecting to your dashboard…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
