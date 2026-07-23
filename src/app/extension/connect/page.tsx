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
import { isExtensionHandoffAllowed } from "@/lib/care/extensionHandoff";

// Minimal typing for the extension-messaging bridge that externally_connectable exposes on this origin.
type ChromeRuntime = {
  runtime?: {
    sendMessage?: (
      extensionId: string,
      message: unknown,
      callback?: (response?: { ok?: boolean }) => void
    ) => void;
    lastError?: unknown;
  };
};

export default function ExtensionConnectPage() {
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "signedout">("loading");
  const [copied, setCopied] = useState(false);
  const [autoConnected, setAutoConnected] = useState(false);

  useEffect(() => {
    if (!supabaseEnabled) {
      setState("signedout");
      return;
    }
    const sb = createClient();
    sb.auth.getSession().then(({ data }) => {
      const t = data.session?.access_token ?? null;
      const refresh = data.session?.refresh_token ?? null;
      setToken(t);
      setState(t ? "ready" : "signedout");

      // Auto-handoff: the extension opens this page as /extension/connect?ext=<its id>. If that id is
      // present and the extension exposed chrome.runtime here (externally_connectable), send the tokens
      // straight to it — so "Sign in" is a one-click connect with no manual paste. The refresh token lets
      // the extension renew silently instead of dropping you after ~1h (audit A4).
      if (!t) return;
      const ext = new URLSearchParams(window.location.search).get("ext");
      const chromeApi = (window as unknown as { chrome?: ChromeRuntime }).chrome;
      // SECURITY (founder audit 2026-07-23): `ext` is an attacker-controllable URL param, and we're about to hand
      // it the session AND long-lived REFRESH token. When the official extension id is configured
      // (NEXT_PUBLIC_CARE_EXTENSION_ID — set it to the Web Store id in production), ONLY hand off to that id, so a
      // lure to /extension/connect?ext=<malicious-id> cannot exfiltrate the token to an attacker's extension. When
      // it is NOT configured (unpacked dev has a per-install id we can't pin), behavior is unchanged — hand off,
      // but log, so the missing pin is visible. Option (b) — an explicit user "Connect?" confirmation — remains
      // available on top of this if the founder wants the dev/unset path hardened too.
      const allowedExtId = process.env.NEXT_PUBLIC_CARE_EXTENSION_ID || "";
      const extAllowed = isExtensionHandoffAllowed(ext, allowedExtId);
      if (ext && allowedExtId && !extAllowed) {
        // eslint-disable-next-line no-console
        console.warn(
          `[care.connect] refused token hand-off: ext id "${ext}" is not the configured official extension id.`
        );
      }
      if (ext && extAllowed && chromeApi?.runtime?.sendMessage) {
        if (!allowedExtId) {
          // eslint-disable-next-line no-console
          console.warn(
            "[care.connect] NEXT_PUBLIC_CARE_EXTENSION_ID is not set — handing the session token to the ext id from the URL without pinning it. Set it to the official extension id in production to close the token-handoff vector."
          );
        }
        try {
          chromeApi.runtime.sendMessage(
            ext,
            { type: "care-connect", token: t, refreshToken: refresh },
            (resp) => {
              if (resp?.ok) setAutoConnected(true);
            }
          );
        } catch {
          /* falls back to the copy-paste UI below */
        }
      }
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
          When you open this page from the extension&apos;s <strong className="text-primary">Sign in</strong>{" "}
          button, it connects automatically — you can close this tab and use the panel. If it didn&apos;t connect,
          the token below is a manual fallback.
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

        {state === "ready" && autoConnected && (
          <div className="glass-card p-6 border border-emerald-500/30">
            <p className="text-lg font-bold text-primary mb-1 flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" /> Connected
            </p>
            <p className="text-sm text-secondary leading-relaxed">
              The C.A.R.E extension is signed in. You can close this tab and start using the tools — highlight a
              conversation and run Summarize or Dissect.
            </p>
          </div>
        )}

        {state === "ready" && token && !autoConnected && (
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
