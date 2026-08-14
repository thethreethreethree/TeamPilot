"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient, supabaseEnabled } from "@/lib/supabase/client";
import { signupConfirmRedirectUrl } from "@/lib/auth/passwordRecovery";
import { Activity, CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { LearningHint } from "@/components/learning/LearningHint";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { fetchLanding } from "@/lib/nav/landing";

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
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: signupConfirmRedirectUrl() },
        });
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
      // Land the new team member in the company's module (not the hub), same rule as login.
      const landing = await fetchLanding();
      setTimeout(() => router.push(landing), 1500);
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
                <LearningHint
                  as="block"
                  category="Invitation · Join a team"
                  title="Your work email"
                  whatItIs="The email that becomes your identity on the team you're joining — and the account every future login uses."
                  why="Accepting an invite attaches you to the inviting company's record. That link is only clean if one email means one person, so this is what ties your contributions to you from day one."
                  how="Use your real work address. If the invite was sent to a specific email, using that same one keeps everything consistent."
                  principle="You join as a single, identifiable person — the team's record starts honest."
                >
                <input
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full bg-surface border border-default rounded-lg px-3.5 py-2.5 text-sm text-primary focus:outline-none focus:border-ember-400/50"
                />
                </LearningHint>
                <LearningHint
                  as="block"
                  category="Invitation · Join a team"
                  title="Your password"
                  whatItIs="The secret for your new (or existing) account. New here means you're creating it now; returning means it's the one you already have."
                  why="Joining gives you access to the team's candid working record. That access has to be genuinely yours alone, which is what this credential protects."
                  how="At least 6 characters for a new account. Already have an ELOSTATE account on this email? Switch to sign-in below and use your existing password."
                  principle="Access to a team's honest record must belong to exactly one person."
                >
                <PasswordInput
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full bg-surface border border-default rounded-lg px-3.5 py-2.5 text-sm text-primary focus:outline-none focus:border-ember-400/50"
                />
                </LearningHint>
                {mode === "signup" && (
                  <LearningHint
                    as="block"
                    category="Invitation · Join a team"
                    title="Your name"
                    whatItIs="The name your teammates will see next to your activity in shared views. Optional — you can add it later."
                    why="A record of who did what is only useful if 'who' is legible. A name turns an account into a recognizable teammate; leaving it blank just means you show up less identifiably until you set it."
                    how="Type how you'd like to appear to the team. Skip it if you'd rather — nothing is blocked, and you can set it from your profile afterward."
                    principle="The system captures contribution; a name makes that contribution recognizably yours."
                  >
                  <input
                    type="text"
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your name (optional)"
                    className="w-full bg-surface border border-default rounded-lg px-3.5 py-2.5 text-sm text-primary focus:outline-none focus:border-ember-400/50"
                  />
                  </LearningHint>
                )}
                {error && <p className="text-xs text-red-400">{error}</p>}
                <LearningHint
                  as="block"
                  category="Invitation · Join a team"
                  title={mode === "signup" ? "Create account & accept" : "Sign in & accept"}
                  whatItIs="Does two things at once: authenticates you, then redeems the invite code to attach your account to the inviting company."
                  why="Combining them means you never land in the awkward middle state of being signed in but not yet on the team. One action, one outcome — you're either in, or told exactly why not."
                  how="Fill the fields above and submit. If the invite needs email confirmation first, you'll be told to confirm and return."
                  principle="Bind the steps that only make sense together, so the user is never stranded between them."
                >
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
                </LearningHint>
              </form>
              <p className="text-center text-xs text-muted mt-4">
                {mode === "signup" ? "Already have an account? " : "Need an account? "}
                <LearningHint
                  as="inline-block"
                  category="Invitation · Join a team"
                  title="Already have an account, or need a new one?"
                  whatItIs="Switches this form between creating a fresh account and signing in with one you already have — both paths end in accepting the invite."
                  why="People get invited on emails they already use here and on brand-new ones. Making the choice explicit avoids a failed sign-up on an email that already exists (or vice-versa), and it clears the password on switch so nothing crosses over."
                  how="Invited on an email you already use for ELOSTATE? Switch to sign in. Brand new? Stay on sign up."
                  principle="Meet the user where they already are — don't force a second account onto someone who has one."
                >
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === "signup" ? "signin" : "signup");
                    setError("");
                    setPassword("");
                  }}
                  className="text-brand hover:text-primary"
                >
                  {mode === "signup" ? "Sign in instead" : "Sign up instead"}
                </button>
                </LearningHint>
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
              <LearningHint
                as="block"
                category="Invitation · Join a team"
                title="Your name"
                whatItIs="How you'll appear in team views once you've joined. Optional, and editable later from your profile."
                why="You're already signed in, so this isn't about access — it's about being recognizable. A name makes your presence in shared views legible to teammates instead of an anonymous account."
                how="Type the name you'd like teammates to see, or leave it blank and set it later. Either way, accepting still works."
                principle="Identity for access is one thing; being recognizable to your team is another — this is the second."
              >
              <input
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name (optional, used in team views)"
                className="w-full bg-surface border border-default rounded-lg px-3.5 py-2.5 text-sm text-primary focus:outline-none focus:border-ember-400/50 mb-3"
              />
              </LearningHint>
              {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
              <LearningHint
                as="block"
                category="Invitation · Join a team"
                title="Accept invitation"
                whatItIs="Redeems the invite code and attaches your already-signed-in account to the inviting company, then takes you to your dashboard."
                why="This is the single, deliberate act of joining. It's confirm-first rather than automatic so you're never pulled into a company's data without an explicit yes."
                how="Tap to accept. On success you'll see a brief welcome, then land in the shared dashboard."
                principle="Joining another team's record is a choice you make on purpose, never one that just happens to you."
              >
              <button
                onClick={acceptInvitation}
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 bg-ember-400 hover:bg-ember-500 disabled:opacity-40 text-[#09090B] font-semibold py-2.5 rounded-lg transition-all text-sm"
              >
                {busy ? "Accepting…" : "Accept invitation"}
                {!busy && <ArrowRight className="w-4 h-4" />}
              </button>
              </LearningHint>
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
