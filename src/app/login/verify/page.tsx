"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { createClient, supabaseEnabled } from "@/lib/supabase/client";
import { safeRelativePath } from "@/lib/nav/safeRedirect";

/**
 * /login/verify — the code step of multi-factor sign-in (2026-11-23). The guards send a signed-in person here when
 * their account has an authenticator and this session has not passed a code; everything else waits until it has.
 */
function VerifyInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeRelativePath(params.get("next")) ?? "/dashboard";
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/me/mfa/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        if (r.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(next)}`);
          return;
        }
        setErr(j.error ?? "That didn't work. Try again.");
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setErr("Couldn't reach the server. Check your connection.");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    if (supabaseEnabled) await createClient().auth.signOut();
    router.replace("/login");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-base px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-default bg-surface p-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-brand" aria-hidden />
          <h1 className="text-base font-semibold text-primary">Enter your sign-in code</h1>
        </div>
        <p className="text-sm text-secondary">Open your authenticator app and type the 6-digit code it shows for this account.</p>
        <label htmlFor="mfa-code" className="sr-only">6-digit code</label>
        <input
          id="mfa-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={7}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))}
          placeholder="123 456"
          className="w-full rounded-lg border border-default bg-base px-3 py-2.5 text-center text-lg tracking-[0.3em] tabular-nums text-primary"
        />
        {err && <p className="text-sm text-amber-700 dark:text-amber-300" role="alert">{err}</p>}
        <button type="submit" disabled={busy || code.replace(/\s/g, "").length !== 6}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2.5 text-sm font-semibold text-black disabled:opacity-50">
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Continue
        </button>
        <button type="button" onClick={() => void signOut()} className="w-full text-center text-xs text-muted hover:text-primary">
          Lost your phone? Sign out — a company admin can remove the authenticator from your account.
        </button>
      </form>
    </main>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyInner />
    </Suspense>
  );
}
