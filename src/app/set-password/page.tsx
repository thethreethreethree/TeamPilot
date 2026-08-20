"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Check, X } from "lucide-react";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { validateStrongPassword } from "@/lib/auth/passwordPolicy";

/**
 * Forced first-login password change (Add-agent upgrade, 2026-08-21). A user the admin added with a shared TEAM
 * PASSWORD is redirected here by the dashboard layout (must_change_password) and cannot proceed until they set
 * their own password. Posts to /api/team/set-password (service-role sets the password + clears the flag), then
 * bounces to the dashboard. Lives OUTSIDE /dashboard so the layout's redirect doesn't loop.
 */

const RULES: { label: string; ok: (p: string) => boolean }[] = [
  { label: "At least 8 characters", ok: (p) => p.length >= 8 },
  { label: "An uppercase letter", ok: (p) => /[A-Z]/.test(p) },
  { label: "A lowercase letter", ok: (p) => /[a-z]/.test(p) },
  { label: "A number", ok: (p) => /[0-9]/.test(p) },
  { label: "A special character", ok: (p) => /[^A-Za-z0-9\s]/.test(p) },
];

export default function SetPasswordPage() {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<{ kind: "idle" | "submitting" } | { kind: "error"; message: string }>({ kind: "idle" });

  const policy = validateStrongPassword(pw);
  const matches = pw.length > 0 && pw === confirm;
  const canSubmit = policy.ok && matches && state.kind !== "submitting";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      setState({ kind: "error", message: !policy.ok ? policy.error : "Passwords don't match." });
      return;
    }
    setState({ kind: "submitting" });
    try {
      const res = await fetch("/api/team/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setState({ kind: "error", message: j?.error ?? "Couldn't set your password. Please try again." });
        return;
      }
      // Password set + flag cleared server-side; go to the dashboard (refresh re-runs the layout gate).
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setState({ kind: "error", message: "Couldn't reach the server. Please try again." });
    }
  };

  return (
    <main className="min-h-screen bg-base flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-9 h-9 rounded-lg bg-ember-400/15 flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-ember-400" aria-hidden />
          </div>
          <h1 className="text-xl font-bold text-primary">Set your password</h1>
        </div>
        <p className="text-sm text-secondary mb-6">
          Welcome to the team. Your account was created with a shared team password — choose your own password to
          finish setting up. You&apos;ll use it every time you sign in.
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-secondary mb-1">New password</label>
            <PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" autoFocus placeholder="Your new password"
              className="w-full rounded-lg bg-surface border border-white/10 px-3 py-2 text-sm text-primary placeholder:text-muted" />
          </div>
          <div>
            <label className="block text-xs font-medium text-secondary mb-1">Confirm password</label>
            <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" placeholder="Type it again"
              className="w-full rounded-lg bg-surface border border-white/10 px-3 py-2 text-sm text-primary placeholder:text-muted" />
          </div>

          <ul className="space-y-1 rounded-lg bg-surface border border-white/10 p-3">
            {RULES.map((r) => {
              const ok = r.ok(pw);
              return (
                <li key={r.label} className={`flex items-center gap-2 text-xs ${ok ? "text-emerald-400" : "text-muted"}`}>
                  {ok ? <Check className="w-3.5 h-3.5" aria-hidden /> : <X className="w-3.5 h-3.5" aria-hidden />}
                  {r.label}
                </li>
              );
            })}
            <li className={`flex items-center gap-2 text-xs ${matches ? "text-emerald-400" : "text-muted"}`}>
              {matches ? <Check className="w-3.5 h-3.5" aria-hidden /> : <X className="w-3.5 h-3.5" aria-hidden />}
              Passwords match
            </li>
          </ul>

          {state.kind === "error" && <p className="text-xs text-rose-400">{state.message}</p>}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-ember-400 text-[#09090B] font-semibold text-sm py-2.5 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-ember-300 transition-colors"
          >
            {state.kind === "submitting" ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <KeyRound className="w-4 h-4" aria-hidden />}
            Set password &amp; continue
          </button>
        </form>
      </div>
    </main>
  );
}
