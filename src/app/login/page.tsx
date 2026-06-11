"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, supabaseEnabled } from "@/lib/supabase/client";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { BrandLogo } from "@/components/brand/Logo";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");

    // Demo mode jumps straight to the dashboard. Keep the button
    // disabled across the redirect so a user can't double-click during
    // the navigation window — same UX rule as the live path below.
    if (!supabaseEnabled) {
      setLoading(true);
      router.push("/dashboard");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) {
          // Signup needs email confirmation — surface the notice and
          // re-enable the button so the user can sign in once confirmed.
          setNotice("Check your email to confirm your account, then sign in.");
          setMode("signin");
          setLoading(false);
          return;
        }
        router.push("/onboarding");
        router.refresh();
        // NOTE: deliberately not resetting loading on the success path.
        // setLoading(false) here would re-enable the button between
        // router.push() firing and the page actually unmounting, which
        // lets users click again and feel like the submit "didn't work."
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // Route to onboarding if the user has no company yet.
      const { data: auth } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", auth.user!.id)
        .maybeSingle();

      router.push(profile?.company_id ? "/dashboard" : "/onboarding");
      router.refresh();
      // Same as the signup-with-session branch — leave loading=true
      // so the button stays disabled through the redirect.
    } catch (err) {
      // Only the failure path resets loading; the user needs to fix
      // their input and retry.
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base flex items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bulb-glow rounded-full" />
      </div>

      <div className="w-full max-w-sm relative">
        <div className="flex flex-col items-center mb-8">
          {/* Canonical logo (bulb + ELOSTATE wordmark as provided). */}
          <BrandLogo width={160} height={160} priority className="shadow-glow-ember" />
        </div>

        <div className="glass-card p-8">
          <h1 className="text-xl font-bold text-primary mb-1">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-sm text-muted mb-6">
            {mode === "signin"
              ? "Sign in to your team's problem-solving system"
              : "Set up your team's problem-solving system"}
          </p>

          {!supabaseEnabled && (
            <div className="mb-5 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/40 text-xs text-primary">
              Demo mode — Supabase not configured. Submitting will take you straight into the
              dashboard with mock data.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-secondary mb-1.5">Email</label>
              <input
                type="email"
                required
                disabled={loading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ceo@company.com"
                className="w-full bg-surface border border-default rounded-lg px-3.5 py-2.5 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-[#FACC15]/50 focus:ring-1 focus:ring-[#FACC15]/30 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-secondary mb-1.5">Password</label>
              <input
                type="password"
                required
                minLength={6}
                disabled={loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-surface border border-default rounded-lg px-3.5 py-2.5 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-[#FACC15]/50 focus:ring-1 focus:ring-[#FACC15]/30 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}
            {notice && <p className="text-xs text-emerald-400">{notice}</p>}

            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#FACC15] hover:bg-[#EAB308] disabled:opacity-60 disabled:cursor-not-allowed text-[#09090B] font-semibold py-2.5 rounded-lg transition-colors shadow-glow hover:shadow-none"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  {mode === "signin"
                    ? "Signing you in…"
                    : "Creating account…"}
                </>
              ) : (
                <>
                  {mode === "signin"
                    ? "Enter ELOSTATE"
                    : "Create account"}
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-muted mt-6">
            {mode === "signin" ? "No account? " : "Already have an account? "}
            <button
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError("");
                setNotice("");
              }}
              disabled={loading}
              className="text-brand hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mode === "signin" ? "Set up ELOSTATE" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
      <InstallPrompt />
    </div>
  );
}
