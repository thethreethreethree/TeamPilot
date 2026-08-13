"use client";

/**
 * /extension/connect — hands the logged-in user's session token to a browser extension. Serves BOTH the
 * C.A.R.E extension (default) and the Sales Coach extension (/extension/connect?product=sales) — one page,
 * product-parameterized (A21): each product gets its own connect message type and its own pinned extension
 * id, so the default (no `product`) is byte-for-byte the original C.A.R.E behavior.
 *
 * MV3 extensions can't read the app's cookies, so the extension can't auto-detect a web login. This page
 * (which requires being logged in) reads the client-side Supabase session and, when opened from the
 * extension's Sign in button (?ext=<id>), hands the token straight to that extension; a copy field is the
 * manual fallback.
 *
 * §3.4: the token is the user's own session, shown only to them on an authed page; the handoff goes only to
 * the pinned official extension id (see the security note in the effect).
 */

import { useEffect, useState } from "react";
import { createClient, supabaseEnabled } from "@/lib/supabase/client";
import { isExtensionHandoffAllowed } from "@/lib/care/extensionHandoff";
import { selectConnectPanel } from "@/lib/care/connectPanelState";

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
  // The ext id that was REFUSED, if any — set when the URL's ?ext= id doesn't match the configured official
  // extension id. Surfaced on-screen (not just console) so an id-pin mismatch reads as a clear message instead
  // of a silent drop to the manual/copy fallback (founder-approved 2026-08-13).
  const [refusedExtId, setRefusedExtId] = useState<string | null>(null);
  // Which extension this page is connecting. Default C.A.R.E (no `product` param) → the C.A.R.E behavior is
  // byte-for-byte unchanged; the Sales Coach extension opens /extension/connect?product=sales. One page,
  // both extensions (A21) — each gets its own message type + its own pinned extension id.
  const [isSales, setIsSales] = useState(false);
  const productLabel = isSales ? "Sales Coach" : "C.A.R.E";

  useEffect(() => {
    // Read the product up front so the labels + the login-return path reflect it even before the session resolves.
    const productParam = new URLSearchParams(window.location.search).get("product") || "care";
    const sales = productParam === "sales";
    setIsSales(sales);

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
      // Pin to the PRODUCT's own official extension id (each extension has a distinct id + a distinct
      // connect message type), so a lure to ?ext=<malicious-id> can't exfiltrate the token to another
      // extension. Sales uses NEXT_PUBLIC_SALES_EXTENSION_ID; C.A.R.E keeps NEXT_PUBLIC_CARE_EXTENSION_ID.
      const idEnvName = sales ? "NEXT_PUBLIC_SALES_EXTENSION_ID" : "NEXT_PUBLIC_CARE_EXTENSION_ID";
      const allowedExtId =
        (sales ? process.env.NEXT_PUBLIC_SALES_EXTENSION_ID : process.env.NEXT_PUBLIC_CARE_EXTENSION_ID) || "";
      const connectType = sales ? "sales-connect" : "care-connect";
      const extAllowed = isExtensionHandoffAllowed(ext, allowedExtId);
      if (ext && allowedExtId && !extAllowed) {
        setRefusedExtId(ext);
        // eslint-disable-next-line no-console
        console.warn(
          `[${connectType}] refused token hand-off: ext id "${ext}" is not the configured official extension id.`
        );
      }
      if (ext && extAllowed && chromeApi?.runtime?.sendMessage) {
        if (!allowedExtId) {
          // eslint-disable-next-line no-console
          console.warn(
            `[${connectType}] ${idEnvName} is not set — handing the session token to the ext id from the URL without pinning it. Set it to the official extension id in production to close the token-handoff vector.`
          );
        }
        try {
          chromeApi.runtime.sendMessage(
            ext,
            { type: connectType, token: t, refreshToken: refresh },
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

  // ONE decision for which panel to show (see selectConnectPanel) — the security invariant (never offer the
  // token on a refused/connected state) lives in that pure, tested function instead of six inline conditions.
  const panel = selectConnectPanel({ state, token, autoConnected, refusedExtId, isSales });

  return (
    <div className="min-h-screen bg-base text-primary px-6 py-16">
      <div className="max-w-xl mx-auto">
        <p className="text-[11px] uppercase tracking-[0.2em] text-brand font-semibold mb-3">{productLabel} Extension</p>
        <h1 className="text-2xl md:text-3xl font-bold text-primary leading-tight mb-2">Connect the extension</h1>
        <p className="text-sm text-secondary mb-8 leading-relaxed">
          When you open this page from the extension&apos;s <strong className="text-primary">Sign in</strong>{" "}
          button, it connects automatically — you can close this tab and use the panel. If it didn&apos;t connect,
          the token below is a manual fallback.
        </p>

        {panel === "loading" && <p className="text-sm text-muted">Checking your session…</p>}

        {panel === "signedout" && (
          <div className="glass-card p-6">
            <p className="text-sm text-secondary mb-4">You&apos;re not signed in. Sign in first, then come back here.</p>
            <a
              href={isSales ? "/login?next=%2Fextension%2Fconnect%3Fproduct%3Dsales" : "/login?next=%2Fextension%2Fconnect"}
              className="inline-flex items-center gap-2 bg-ember-400 hover:bg-ember-500 text-[#09090B] font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm"
            >
              Sign in
            </a>
          </div>
        )}

        {panel === "connected" && (
          <div className="glass-card p-6 border border-emerald-500/30">
            <p className="text-lg font-bold text-primary mb-1 flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" /> Connected
            </p>
            <p className="text-sm text-secondary leading-relaxed">
              The {productLabel} extension is signed in. You can close this tab and start using the tools —
              highlight a conversation and run a tool from the panel.
            </p>
          </div>
        )}

        {/* Handoff REFUSED — the extension that opened this page isn't the pinned official id. Show WHY on-screen
            (founder-approved 2026-08-13) instead of a silent drop to the fallback, so an id-pin mismatch is
            diagnosable. Replaces both product fallbacks when it's the reason the auto-connect didn't fire. */}
        {panel === "refused" && (
          <div className="glass-card p-6 border border-amber-500/40">
            <p className="text-lg font-bold text-primary mb-1 flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500" /> Extension not recognized
            </p>
            <p className="text-sm text-secondary leading-relaxed mb-2">
              This site is set to connect only to the official {productLabel} extension, and the one that opened
              this page isn&apos;t it, so the sign-in was refused for your safety.
            </p>
            <p className="text-[11px] text-muted leading-relaxed break-all mb-2">
              Extension id seen: <span className="font-mono text-secondary">{refusedExtId}</span>
            </p>
            <p className="text-sm text-secondary leading-relaxed">
              If you&apos;re running a <strong className="text-primary">development / unpacked</strong> build, the
              pinned id needs to be cleared for it to connect — tell the person who set it up. Otherwise, install
              the official {productLabel} extension and try again.
            </p>
          </div>
        )}

        {/* SALES has no manual-paste path — it connects ONLY via the one-click handoff. Showing C.A.R.E's
            "Copy token → Developer connect → paste" flow here is a dead end for a Sales rep (there's nowhere to
            paste it) AND the copied ACCESS token carries no refresh token, so even if pasted it drops after ~1h.
            So for Sales, guide back to the one-click Sign in instead of offering a token to copy. (2026-08-13) */}
        {panel === "sales-guidance" && (
          <div className="glass-card p-6">
            <p className="text-sm text-secondary leading-relaxed mb-2">
              The one-click connect didn&apos;t complete. The Sales Coach extension signs in{" "}
              <strong className="text-primary">automatically</strong> — there is no manual token step.
            </p>
            <p className="text-sm text-secondary leading-relaxed">
              Reopen the Sales Coach panel on your conversation tab and click{" "}
              <strong className="text-primary">Sign in</strong> again (or hit the panel&apos;s{" "}
              <strong className="text-primary">↻ Restart</strong> button). If it keeps failing, your extension may
              not be the one this site is pinned to — tell the person who set it up.
            </p>
          </div>
        )}

        {panel === "care-token" && (
          <div className="glass-card p-6">
            <label className="text-[10px] uppercase tracking-widest text-muted font-semibold">Your session token</label>
            <textarea
              readOnly
              value={token ?? ""}
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
