"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity, CheckCircle2, AlertTriangle, Mail } from "lucide-react";
import { createClient, supabaseEnabled } from "@/lib/supabase/client";
import { LearningHint } from "@/components/learning/LearningHint";
import {
  looksLikeEmail,
  recoverRedirectUrl,
  RECOVERY_REQUESTED_MESSAGE,
} from "@/lib/auth/passwordRecovery";

/**
 * /auth/forgot — the REQUEST side of password recovery.
 *
 * Why this page exists
 * ────────────────────
 * The completion page (/auth/recover) already existed, but there was no way to REQUEST the recovery email —
 * both login pages told users to "use the recovery link" that nothing rendered. This closes that gap: enter an
 * email, and Supabase sends a reset link that lands on /auth/recover.
 *
 * Honesty (§3.4): the confirmation is NEUTRAL — it never reveals whether an account exists for the email
 * (`resetPasswordForEmail` succeeds regardless, so an attacker learns nothing). We surface an error ONLY for a
 * real transport failure (rate-limit / network), never "no such user".
 */

type Phase =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "sent" }
  | { kind: "error"; message: string };

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phase.kind === "submitting") return;

    if (!supabaseEnabled) {
      setPhase({
        kind: "error",
        message: "Live mode required to send a recovery email. Demo mode has no auth.",
      });
      return;
    }
    if (!looksLikeEmail(email)) {
      setPhase({ kind: "error", message: "Enter a valid email address." });
      return;
    }

    setPhase({ kind: "submitting" });
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: recoverRedirectUrl(window.location.origin),
    });
    // Anti-enumeration: on success we show the neutral "sent" state. A returned error here is a transport/
    // rate-limit failure (not "no such account"), so it's honest to surface it for a retry.
    if (error) {
      setPhase({ kind: "error", message: error.message });
      return;
    }
    setPhase({ kind: "sent" });
  };

  return (
    <div className="min-h-screen bg-base flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-ember-400 to-[#FDE047] flex items-center justify-center shadow-glow">
            <Activity className="w-4 h-4 text-white" aria-hidden />
          </div>
          <span className="text-lg font-bold text-primary">ELOSTATE</span>
        </div>

        <div className="glass-card p-8 fade-in">
          <div className="w-12 h-12 rounded-xl bg-ember-400/10 border border-ember-400/20 flex items-center justify-center mb-5">
            <Mail className="w-6 h-6 text-brand" aria-hidden />
          </div>

          {phase.kind === "sent" ? (
            <>
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" aria-hidden />
                <h1 className="text-xl font-bold text-primary">Check your email</h1>
              </div>
              <p className="text-sm text-secondary leading-relaxed mb-5">
                {RECOVERY_REQUESTED_MESSAGE}
              </p>
              <p className="text-xs text-muted mb-5">
                The link opens a page where you set a new password. It expires after a while — request another if
                it lapses.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm text-brand hover:text-primary"
              >
                ← Back to sign in
              </Link>
            </>
          ) : (
            <form onSubmit={submit}>
              <h1 className="text-xl font-bold text-primary mb-1">Reset your password</h1>
              <p className="text-sm text-muted mb-5">
                Enter your account email and we&apos;ll send you a link to set a new password.
              </p>

              <LearningHint
                as="block"
                category="Account · Password recovery"
                title="Account email"
                whatItIs="The email your ELOSTATE account is registered under — where the reset link will be sent."
                why="Recovery works by proving you control the inbox tied to the account. We send the link and never reveal whether an email is registered, so the confirmation looks the same either way — that privacy is deliberate, not a bug."
                how="Use the same email you sign in with. Then check your inbox (and spam) for the link, which opens the set-a-new-password page."
                principle="Restore access on your own proof of identity — no admin ever handles your password."
              >
                <label
                  htmlFor="forgot-email"
                  className="block text-xs font-medium text-secondary mb-1.5"
                >
                  Email
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={phase.kind === "submitting"}
                  placeholder="you@company.com"
                  className="w-full bg-surface border border-default rounded-lg px-4 py-2.5 text-primary placeholder:text-muted focus:outline-none focus:border-ember-400/50 focus:ring-1 focus:ring-ember-400/30 transition-colors text-base mb-5 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </LearningHint>

              {phase.kind === "error" && (
                <p className="flex items-start gap-1.5 text-xs text-red-400 mb-4">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden />
                  {phase.message}
                </p>
              )}

              <button
                type="submit"
                disabled={phase.kind === "submitting" || !email}
                className="w-full flex items-center justify-center gap-2 bg-ember-400 hover:bg-ember-500 disabled:opacity-50 disabled:cursor-not-allowed text-[#09090B] font-semibold px-6 py-2.5 rounded-lg transition-all text-sm"
              >
                {phase.kind === "submitting" ? "Sending…" : "Send reset link"}
              </button>

              <p className="text-center text-xs text-muted mt-6">
                Remembered it?{" "}
                <Link href="/login" className="text-brand hover:text-primary transition-colors">
                  Back to sign in
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
