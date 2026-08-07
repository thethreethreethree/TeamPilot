/**
 * Shared token-refresh handler for the browser extensions (C.A.R.E and Sales Coach).
 *
 * Both extensions' access tokens expire (~1h). Rather than force a reconnect, the extension calls its
 * /refresh route when a tool returns 401; that route proxies Supabase's refresh-token grant SERVER-side, so
 * the extension never needs the Supabase host in its permissions and the anon key stays out of the bundle.
 *
 * This is the ONE mechanism both refresh routes share (A21 — one implementation, not a per-extension fork):
 * it is generic Supabase-session refresh with NO product coupling (no entitlement, no tenant logic). Each
 * route supplies its own rate-limit id + validation and maps this result to a NextResponse.
 *
 * There is no auth gate here — the refresh_token IS the credential (the access token is expired, which is
 * why we're refreshing). Supabase validates the grant and returns 401 if the refresh token is invalid.
 */

export type ExtensionRefreshResult =
  | { ok: true; accessToken: string; refreshToken: string }
  | { ok: false; status: 500 | 401 | 502; error: string };

export async function refreshExtensionSession(
  refreshToken: string
): Promise<ExtensionRefreshResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return { ok: false, status: 500, error: "Auth not configured." };
  }

  try {
    const res = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: anon, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
    };
    if (!res.ok || !data.access_token) {
      return { ok: false, status: 401, error: "Session could not be refreshed. Sign in again." };
    }
    // Supabase may or may not rotate the refresh token; when it omits one, keep the one we sent.
    return {
      ok: true,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
    };
  } catch {
    return { ok: false, status: 502, error: "Couldn't reach the auth service." };
  }
}
