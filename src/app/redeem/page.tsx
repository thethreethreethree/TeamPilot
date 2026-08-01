"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient, supabaseEnabled } from "@/lib/supabase/client";
import { Activity, CheckCircle2, Loader2, ArrowRight, KeyRound } from "lucide-react";
import { PasswordInput } from "@/components/ui/PasswordInput";

/**
 * /redeem — pilot access-code redemption (self-serve pilot onboarding).
 *
 * Flow:
 *   1. "code"    — enter the 7-char access key → validate (non-consuming) → show module.
 *   2. "details" — Company name + Email + Password (+ optional name) → sign up → redeem.
 *   3. "done"    — redirect to the module's landing page.
 *
 * The code is only consumed at step 2 (redeem_pilot_code). Mirrors /invite/[code]
 * but creates a NEW company provisioned for the code's module.
 */

const MODULE_LABEL: Record<string, string> = {
  elostate: "ELOSTATE — Complete System",
  care: "C.A.R.E — Customer Support Engine",
  sales_coach: "Sales Coach",
};

function RedeemInner() {
  const router = useRouter();
  const search = useSearchParams();

  // Errors are surfaced INLINE within the code/details phases (setError), so there is no terminal
  // "error" phase — every failure leaves the user on the current step able to retry or go back.
  const [phase, setPhase] = useState<"code" | "details" | "done">("code");
  const [code, setCode] = useState("");
  const [module, setModule] = useState<string>("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Synchronous latch for account-create/redeem: the button disables on `busy`
  // a render too late, so a double-click would fire a second signUp (erroring
  // "already registered" on the user's own click) or a second redeem POST.
  const creatingRef = useRef(false);
  const [notice, setNotice] = useState("");

  // Prefill (only) a code passed in the URL (?code=XXXXXXX) so a /redeem?code=…
  // deep link lands with the key filled in. We deliberately do NOT auto-submit —
  // the visitor reviews the prefilled key and clicks Continue themselves. (If we
  // ever want one-click deep-link redemption, call validateCode() here once the
  // code is set — flagged as an option, not wired, to keep the flow user-driven.)
  useEffect(() => {
    const q = search.get("code");
    if (q) setCode(q.toUpperCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!supabaseEnabled) {
      setError("Live mode required to redeem an access code.");
      return;
    }
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      setError("Enter your access key.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/pilot/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalized }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't check that code.");
      if (data.redeemed) throw new Error("This access key has already been used.");
      if (!data.valid) throw new Error("That access key isn't valid. Check it and try again.");
      setModule(data.module);
      setCode(normalized);
      setPhase("details");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't check that code.");
    } finally {
      setBusy(false);
    }
  };

  const createAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creatingRef.current) return;
    creatingRef.current = true;
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const supabase = createClient();

      // If the visitor is ALREADY authenticated — they signed in earlier, or they
      // just confirmed their email (the confirmation link establishes a session) and
      // came back — skip sign-up entirely and redeem with the existing session.
      // Calling signUp again on an existing email would fail "already registered" and
      // dead-end the flow.
      const { data: existing } = await supabase.auth.getUser();
      if (!existing.user) {
        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpErr) {
          // A pre-existing account on this email lands here. Guide them to sign in
          // rather than silently failing — the code is still unredeemed.
          const msg = /already|registered|exists/i.test(signUpErr.message)
            ? "An account already exists for that email. Sign in first (top-right), then return here and re-enter your key."
            : signUpErr.message;
          throw new Error(msg);
        }
        if (!signUpData.session) {
          // Email confirmation is enabled on the project → no session yet. The code
          // is still unredeemed; ask them to confirm and return.
          setNotice(
            "Check your email to confirm your account, then return to this page and re-enter your key to finish."
          );
          creatingRef.current = false;
          setBusy(false);
          return;
        }
      }
      const res = await fetch("/api/pilot/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, companyName, fullName: fullName || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Redemption failed.");
      setPhase("done");
      setTimeout(() => router.push(data.landing ?? "/dashboard"), 1400);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      creatingRef.current = false;
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
          {phase === "code" && (
            <>
              <div className="flex items-center gap-2 mb-1">
                <KeyRound className="w-4 h-4 text-brand" aria-hidden />
                <h1 className="text-lg font-semibold text-primary">Enter your access key</h1>
              </div>
              <p className="text-sm text-secondary mb-6">
                Your pilot access key unlocks account creation. Don&apos;t have one?{" "}
                <a href="/login" className="text-brand hover:text-primary">
                  Request access
                </a>
                .
              </p>
              <form onSubmit={validateCode} className="space-y-3">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. ABCD234"
                  maxLength={7}
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="Access key"
                  className="w-full bg-surface border border-default rounded-lg px-3.5 py-2.5 text-base tracking-[0.3em] font-mono text-center uppercase text-primary focus:outline-none focus:border-ember-400/50"
                />
                {error && <p className="text-xs text-red-400" role="alert">{error}</p>}
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full flex items-center justify-center gap-2 bg-ember-400 hover:bg-ember-500 disabled:opacity-40 text-[#09090B] font-semibold py-2.5 rounded-lg transition-all text-sm"
                >
                  {busy ? "Checking…" : "Continue"}
                  {!busy && <ArrowRight className="w-4 h-4" />}
                </button>
              </form>
            </>
          )}

          {phase === "details" && (
            <>
              <h1 className="text-lg font-semibold text-primary mb-1">Create your account</h1>
              <p className="text-sm text-secondary mb-1">
                Your key unlocks{" "}
                <span className="font-semibold text-brand">
                  {MODULE_LABEL[module] ?? "ELOSTATE"}
                </span>
                .
              </p>
              <p className="text-xs text-muted mb-5">Set up your company and sign-in.</p>
              <form onSubmit={createAccount} className="space-y-3">
                <div>
                  <label className="text-xs text-secondary mb-1 block">Company name</label>
                  <input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                    placeholder="Acme Inc."
                    autoFocus
                    className="w-full bg-surface border border-default rounded-lg px-3.5 py-2.5 text-sm text-primary focus:outline-none focus:border-ember-400/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-secondary mb-1 block">Work email</label>
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
                </div>
                <div>
                  <label className="text-xs text-secondary mb-1 block">Password</label>
                  <PasswordInput
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full bg-surface border border-default rounded-lg px-3.5 py-2.5 text-sm text-primary focus:outline-none focus:border-ember-400/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-secondary mb-1 block">
                    Your name <span className="text-muted">(optional)</span>
                  </label>
                  <input
                    type="text"
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your name"
                    className="w-full bg-surface border border-default rounded-lg px-3.5 py-2.5 text-sm text-primary focus:outline-none focus:border-ember-400/50"
                  />
                </div>
                {error && <p className="text-xs text-red-400" role="alert">{error}</p>}
                {notice && <p className="text-xs text-amber-300" role="status">{notice}</p>}
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full flex items-center justify-center gap-2 bg-ember-400 hover:bg-ember-500 disabled:opacity-40 text-[#09090B] font-semibold py-2.5 rounded-lg transition-all text-sm"
                >
                  {busy ? "Creating…" : "Create account"}
                  {!busy && <ArrowRight className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPhase("code");
                    setError("");
                    setNotice("");
                  }}
                  className="w-full text-xs text-muted hover:text-secondary pt-1"
                >
                  ← Use a different key
                </button>
              </form>
            </>
          )}

          {phase === "done" && (
            <div className="text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <p className="text-sm text-primary mb-1">You&apos;re all set.</p>
              <p className="text-xs text-muted">Taking you to your workspace…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RedeemPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-base flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-brand" />
        </div>
      }
    >
      <RedeemInner />
    </Suspense>
  );
}
