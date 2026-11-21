"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { siteUrl } from "@/lib/siteUrl";
import { enabledProviders, OAUTH_PROVIDERS, safeNext } from "@/lib/auth/oauthProviders";

/**
 * "Continue with Google / Microsoft" (RSS Phase 9; Gong F1.2). Renders nothing until the operator lists the provider in
 * NEXT_PUBLIC_AUTH_PROVIDERS (docs/AUTH-REDIRECTS.md "OAuth providers"). The return address is the canonical
 * /auth/callback, never this page's origin, so a preview or marketing domain cannot break it.
 */
export function OAuthButtons({ next }: { next?: string }) {
  const providers = enabledProviders();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (providers.length === 0) return null;
  const go = async (key: (typeof providers)[number]) => {
    setBusy(key);
    setErr(null);
    const p = OAUTH_PROVIDERS[key];
    const { error } = await createClient().auth.signInWithOAuth({
      provider: p.supabase,
      options: {
        redirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(safeNext(next))}`,
        ...(p.scopes ? { scopes: p.scopes } : {}),
      },
    });
    if (error) {
      setErr("That sign-in option isn't available right now. Use your email and password.");
      setBusy(null);
    }
  };
  return (
    <div className="space-y-2">
      {providers.map((k) => (
        <button key={k} type="button" disabled={!!busy} onClick={() => void go(k)}
          className="w-full rounded-lg border border-default bg-base px-4 py-2 text-sm font-medium text-primary hover:bg-surface disabled:opacity-50">
          {busy === k ? "Opening…" : OAUTH_PROVIDERS[k].label}
        </button>
      ))}
      {err && <p className="text-xs text-secondary" role="status">{err}</p>}
      <p className="text-center text-[11px] text-muted">or with your email</p>
    </div>
  );
}
