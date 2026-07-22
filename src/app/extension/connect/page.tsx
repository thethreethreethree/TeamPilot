"use client";

/**
 * /extension/connect — hands the logged-in user's session token to the C.A.R.E browser extension.
 *
 * MV3 extensions can't read the app's cookies, so the extension can't auto-detect a web login. This page
 * (which requires being logged in) reads the client-side Supabase session and shows the access token to
 * copy into the extension's Developer-connect field — the smooth path until one-click OAuth (D3) is wired.
 *
 * §3.4: the token is the user's own session, shown only to them on an authed page; nothing is sent anywhere.
 */

import { useEffect, useState } from "react";
import { createClient, supabaseEnabled } from "@/lib/supabase/client";

export default function ExtensionConnectPage() {
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "signedout">("loading");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!supabaseEnabled) {
      setState("signedout");
      return;
    }
    const sb = createClient();
    sb.auth.getSession().then(({ data }) => {
      const t = data.session?.access_token ?? null;
      setToken(t);
      setState(t ? "ready" : "signedout");
    });
  }, []);

  async function copy() {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard may be blocked — the field is selectable as a fallback */
    }
  }

  return (
    <div className="min-h-screen bg-base text-primary px-6 py-16">
      <div className="max-w-xl mx-auto">
        <p className="text-[11px] uppercase tracking-[0.2em] text-brand font-semibold mb-3">C.A.R.E Extension</p>
        <h1 className="text-2xl md:text-3xl font-bold text-primary leading-tight mb-2">Connect the extension</h1>
        <p className="text-sm text-secondary mb-8 leading-relaxed">
          Copy the token below and paste it into the extension&apos;s <strong className="text-primary">Developer
          connect</strong> field. (One-click sign-in is coming; this is the current connect step.)
        </p>

        {state === "loading" && <p className="text-sm text-muted">Checking your session…</p>}

        {state === "signedout" && (
          <div className="glass-card p-6">
            <p className="text-sm text-secondary mb-4">You&apos;re not signed in. Sign in first, then come back here.</p>
            <a
              href="/login?next=%2Fextension%2Fconnect"
              className="inline-flex items-center gap-2 bg-ember-400 hover:bg-ember-500 text-[#09090B] font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm"
            >
              Sign in
            </a>
          </div>
        )}

        {state === "ready" && token && (
          <div className="glass-card p-6">
            <label className="text-[10px] uppercase tracking-widest text-muted font-semibold">Your session token</label>
            <textarea
              readOnly
              value={token}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full mt-2 h-28 bg-base border border-default rounded-lg p-3 text-[11px] font-mono text-secondary resize-none break-all"
            />
            <div className="flex items-center gap-3 mt-3">
              <button
                type="button"
                onClick={copy}
                className="inline-flex items-center gap-2 bg-ember-400 hover:bg-ember-500 text-[#09090B] font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm"
              >
                {copied ? "Copied ✓" : "Copy token"}
              </button>
              <span className="text-[11px] text-muted">Then: extension → Developer connect → paste → Connect.</span>
            </div>
            <p className="text-[11px] text-muted mt-4 leading-relaxed">
              This token is tied to your session and expires after about an hour — if the extension stops working,
              come back and copy a fresh one. Keep it private; it authenticates as you.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
