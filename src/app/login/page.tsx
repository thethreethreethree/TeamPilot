"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient, supabaseEnabled } from "@/lib/supabase/client";
import { signupConfirmRedirectUrl } from "@/lib/auth/passwordRecovery";
import { safeRelativePath } from "@/lib/nav/safeRedirect";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { fetchLanding } from "@/lib/nav/landing";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { BrandLogo } from "@/components/brand/Logo";
import { LearningHint } from "@/components/learning/LearningHint";

type Mode = "signin" | "signup";

/**
 * Wrap in Suspense so useSearchParams() doesn't break static
 * generation (Next 16 requires a Suspense boundary above any
 * hook that reads URL params during render). Without this the
 * entire build fails at the prerender step — Vercel deploys
 * since 2026-06-19 were all errored on this.
 */
export default function LoginPageWrapper() {
  return (
    <Suspense fallback={null}>
      <LoginPage />
    </Suspense>
  );
}

function LoginPage() {
  const searchParams = useSearchParams();
  // Deep-link to signup: the landing "Request access" CTA points at /login?mode=signup so a cold
  // visitor lands on account creation ("Create your account"), not the returning-user "Welcome back"
  // signin default (which greeted first-time visitors from the marketing CTA). Any other value →
  // signin (the returning-user default). Lazy init so it's set on first render, no flicker.
  const [mode, setMode] = useState<Mode>(() =>
    searchParams?.get("mode") === "signup" ? "signup" : "signin",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  // Optional intent passed by the landing page Feedback link
  // (or any other deep link). When present, we forward it on
  // the post-auth redirect so the dashboard can open the right
  // surface. Without this, /login?intent=feedback was a dead
  // signal — caught in audit 2026-06-19.
  const intent = searchParams?.get("intent") ?? null;
  // `next` returns the user where they came from after auth — notably the extension connect flow
  // (/login?next=%2Fextension%2Fconnect). Without honoring it, a fresh sign-in dead-ended on the dashboard
  // and the extension token handoff never completed ("sign-in did nothing" for a fresh install). Guarded
  // against open redirect: same-origin relative paths only (safeRelativePath). Takes precedence over intent.
  const safeNext = safeRelativePath(searchParams?.get("next") ?? null);
  const buildDestination = (base: string) => {
    if (safeNext) return safeNext;
    if (!intent) return base;
    // For the feedback intent we route to /dashboard/feedback
    // (where 'Submit new feedback' opens the composer
    // automatically on intent=feedback). Other intents pass
    // through to the original base with the intent appended.
    if (intent === "feedback" && base === "/dashboard") {
      return "/dashboard/feedback?intent=feedback";
    }
    const params = new URLSearchParams({ intent });
    return `${base}?${params.toString()}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");

    // Demo mode jumps straight to the dashboard. Keep the button
    // disabled across the redirect so a user can't double-click during
    // the navigation window — same UX rule as the live path below.
    if (!supabaseEnabled) {
      setLoading(true);
      router.push(buildDestination("/dashboard"));
      return;
    }

    setLoading(true);
    const supabase = createClient();

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          // Canonical app URL so a confirmation link lands on the app, not Supabase's Site-URL default.
          options: { emailRedirectTo: signupConfirmRedirectUrl() },
        });
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

      // Route to onboarding if the user has no company yet; otherwise land them in
      // their module — single-module → that module's home, multi/none → the /dashboard
      // hub — resolved server-side (/api/me/landing) so app and website agree. safeNext
      // (extension flow) and intent still take precedence inside buildDestination.
      const { data: auth } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", auth.user!.id)
        .maybeSingle();

      if (!profile?.company_id) {
        router.push("/onboarding");
      } else {
        router.push(buildDestination(await fetchLanding()));
      }
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
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(600px,120vw)] h-[min(600px,120vw)] bulb-glow rounded-full" />
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
            <LearningHint
              as="block"
              category="Account · Sign in"
              title="Your work email"
              whatItIs="The email address that becomes your identity across ELOSTATE — every event, message, and coaching insight is attributed to it."
              why="ELOSTATE derives everything from an immutable per-person event history. That history is only coherent if one email means one person, so this is the anchor the whole record hangs on."
              how="Use your real work address, not a shared inbox. If your team confirmed by email at signup, use that same one so your history stays continuous."
              principle="One identity, one honest record — the account is the spine the diagnosis is built on."
            >
            <div>
              <label className="block text-xs font-medium text-secondary mb-1.5">Email</label>
              <input
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                disabled={loading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ceo@company.com"
                className="w-full bg-surface border border-default rounded-lg px-3.5 py-2.5 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-ember-400/50 focus:ring-1 focus:ring-ember-400/30 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
            </LearningHint>
            <LearningHint
              as="block"
              category="Account · Sign in"
              title="Your password"
              whatItIs="The secret that proves the account is yours before ELOSTATE unlocks your team's data."
              why="The system holds a candid record of how your team actually works — bottlenecks, unperformed behavior, real problems. That honesty is only safe if access is genuinely private, which is what this gate enforces."
              how="At least 6 characters. If you're setting up a new account, pick something you don't reuse elsewhere; forgot it? Use the recovery link rather than creating a second account."
              principle="Honest data is only worth capturing if access to it is genuinely protected."
            >
            <div>
              <label className="block text-xs font-medium text-secondary mb-1.5">Password</label>
              <PasswordInput
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                required
                minLength={6}
                disabled={loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-surface border border-default rounded-lg px-3.5 py-2.5 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-ember-400/50 focus:ring-1 focus:ring-ember-400/30 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
            </LearningHint>

            {mode === "signin" && (
              <div className="-mt-1 text-right">
                <Link
                  href="/auth/forgot"
                  className="text-xs text-muted hover:text-brand transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
            )}

            {error && <p className="text-xs text-red-400">{error}</p>}
            {notice && <p className="text-xs text-emerald-400">{notice}</p>}

            <LearningHint
              as="block"
              category="Account · Sign in"
              title={mode === "signin" ? "Enter ELOSTATE" : "Create account"}
              whatItIs="Submits your credentials. On sign-in it opens your dashboard; on sign-up it creates the account, then routes you into onboarding."
              why="This is the single door into the system. New accounts are sent through onboarding first because ELOSTATE has no fixed day-one behavior — it needs your team's context before it can be useful, and it won't pretend otherwise."
              how="Sign in returns you to where you work. Creating an account hands you off to a short setup so the system starts from your reality, not a generic template."
              principle="No instant results — the system earns its behavior from your team's data, starting the moment you set it up."
            >
            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="w-full flex items-center justify-center gap-2 bg-ember-400 hover:bg-ember-500 disabled:opacity-60 disabled:cursor-not-allowed text-[#09090B] font-semibold py-2.5 rounded-lg transition-colors shadow-glow hover:shadow-none"
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
            </LearningHint>
          </form>

          <p className="text-center text-xs text-muted mt-6">
            {mode === "signin" ? "No account? " : "Already have an account? "}
            <LearningHint
              as="inline-block"
              category="Account · Sign in"
              title="Switch between signing in and creating an account"
              whatItIs="Toggles this form between returning-user sign-in and first-time account creation, without leaving the page."
              why="Two distinct intents share one surface, so the toggle keeps the choice explicit — and it clears the password field on switch so a sign-up secret is never accidentally submitted as a sign-in attempt."
              how="Tap it if you're on the wrong mode. New here? Switch to set up. Already have an account? Switch back to sign in."
              principle="Make the user's intent explicit before acting on it — never guess which door they meant."
            >
            <button
              type="button"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError("");
                setNotice("");
                // Clear password on mode switch so a sign-up
                // password doesn't get auto-submitted as a sign-in
                // attempt (or vice-versa). Email stays — usually
                // the user wants to keep it across the toggle.
                setPassword("");
              }}
              disabled={loading}
              className="text-brand hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mode === "signin" ? "Set up ELOSTATE" : "Sign in"}
            </button>
            </LearningHint>
          </p>
          {/* Legal footer — Terms + Privacy linked from the
              auth surface so the pilot acceptance moment is
              one click away from reading what they're agreeing
              to. */}
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
      <InstallPrompt />
    </div>
  );
}
