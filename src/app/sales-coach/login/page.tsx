"use client";

import { ArrowRight, Loader2, GraduationCap } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, supabaseEnabled } from "@/lib/supabase/client";

/**
 * Sales Coach — branded login (Phase 5).
 *
 * Its own look + URL, but signs in with the SAME Elostate accounts
 * (identical Supabase auth as /login, §A21) and lands the user in the
 * Sales Coach shell (/dashboard/sales-coach).
 *
 * Sign-in ONLY (no signup): Sales Coach users are existing Elostate
 * accounts an admin assigns a role to — new accounts go through Elostate.
 *
 * No access gate here (per the Phase 3 deferral): this authenticates and
 * lands in the shell; it does not check sales_coach_role.
 *
 * UNTESTED at runtime.
 */
export default function SalesCoachLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!supabaseEnabled) {
      setLoading(true);
      router.push("/dashboard/sales-coach");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      // Land in the Sales Coach shell. If the account somehow has no
      // company, the dashboard layout's gate sends them to /onboarding.
      router.push("/dashboard/sales-coach");
      router.refresh();
      // Leave loading=true through the redirect so the button stays
      // disabled (same rule as the Elostate login).
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base flex items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(600px,120vw)] h-[min(600px,120vw)] bulb-glow rounded-full" />
      </div>

      <div className="w-full max-w-sm relative">
        {/* Sales Coach brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-ember-400 flex items-center justify-center shadow-glow-ember mb-3">
            <GraduationCap className="w-9 h-9 text-[#09090B]" aria-hidden />
          </div>
          <p className="text-lg font-bold tracking-tight text-primary">
            Sales Coach
          </p>
          <p className="text-[10px] uppercase tracking-widest text-muted mt-0.5">
            Live Coaching · Growth Reviews
          </p>
        </div>

        <div className="glass-card p-8">
          <h1 className="text-xl font-bold text-primary mb-1">Welcome back</h1>
          <p className="text-sm text-muted mb-6">
            Sign in to your Sales Coach
          </p>

          {!supabaseEnabled && (
            <div className="mb-5 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/40 text-xs text-primary">
              Demo mode — submitting takes you straight into the Sales Coach.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-secondary mb-1.5">
                Email
              </label>
              <input
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                disabled={loading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full bg-surface border border-default rounded-lg px-3.5 py-2.5 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-ember-400/50 focus:ring-1 focus:ring-ember-400/30 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-secondary mb-1.5">
                Password
              </label>
              <input
                type="password"
                autoComplete="current-password"
                required
                minLength={6}
                disabled={loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-surface border border-default rounded-lg px-3.5 py-2.5 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-ember-400/50 focus:ring-1 focus:ring-ember-400/30 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="w-full flex items-center justify-center gap-2 bg-ember-400 hover:bg-ember-500 disabled:opacity-60 disabled:cursor-not-allowed text-[#09090B] font-semibold py-2.5 rounded-lg transition-colors shadow-glow hover:shadow-none"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  Signing you in…
                </>
              ) : (
                <>
                  Enter Sales Coach
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-muted mt-6">
            Part of ELOSTATE.{" "}
            <Link
              href="/login"
              className="text-brand hover:text-primary transition-colors"
            >
              Sign in to ELOSTATE instead
            </Link>
          </p>
          {/* iOS install entry point — this page has no InstallPrompt, so a
              persistent link keeps the /sales-coach/install walkthrough
              reachable on iPhone (AMD-006 L3 — don't strand it). */}
          <p className="text-center text-xs mt-3">
            <Link
              href="/sales-coach/install"
              className="text-muted hover:text-brand transition-colors underline-offset-2 hover:underline"
            >
              Install Sales Coach on iPhone
            </Link>
          </p>
          <p className="mt-6 text-[10px] text-muted text-center">
            By continuing you agree to our{" "}
            <Link href="/terms" className="text-brand hover:underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-brand hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
