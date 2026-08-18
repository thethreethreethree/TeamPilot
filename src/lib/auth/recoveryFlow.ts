/**
 * detectRecoveryFlow — decide how to establish a password-recovery session from the URL.
 *
 * Supabase can deliver the recovery credential in THREE shapes, and the recover page must handle all of them
 * (audit 2026-08-19 HIGH: it previously read only the implicit fragment and errored on the PKCE/verifyOtp
 * formats, leaving recovery dead under @supabase/ssr's forced PKCE flow):
 *   - implicit: `#access_token=…&refresh_token=…` (the historical hash form)   → setSession
 *   - pkce:     `?code=<auth_code>`                                            → exchangeCodeForSession
 *   - otp:      `?token_hash=<hash>&type=recovery`                             → verifyOtp
 * plus an explicit error (`?error=…` / `#error=…`), a mis-configured non-recovery `type`, and the "no
 * credential at all" case. This is the PURE decision (URL in → which path), separated so it is unit-tested;
 * the page performs the matching Supabase call for each kind.
 */

export type RecoveryFlow =
  | { kind: "error"; message: string }
  | { kind: "implicit"; accessToken: string; refreshToken: string }
  | { kind: "pkce"; code: string }
  | { kind: "otp"; tokenHash: string }
  | { kind: "missing" };

const RECOVERY = "recovery";

export function detectRecoveryFlow(hash: string, search: string): RecoveryFlow {
  const frag = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const query = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);

  // 1. An explicit error in EITHER the fragment or the query takes precedence over any credential.
  const errCode =
    query.get("error_code") ?? query.get("error") ?? frag.get("error_code") ?? frag.get("error");
  if (errCode) {
    const errDesc = query.get("error_description") ?? frag.get("error_description");
    return {
      kind: "error",
      message:
        errDesc ??
        `Recovery link returned ${errCode}. The link may have expired or already been used.`,
    };
  }

  const accessToken = frag.get("access_token");
  const refreshToken = frag.get("refresh_token");
  const code = query.get("code");
  const tokenHash = query.get("token_hash");

  // 2. A non-recovery type (signup confirm, magiclink) landing here is a misconfiguration — be explicit so the
  //    user isn't shown a "set new password" form for the wrong flow.
  const flowType = frag.get("type") ?? query.get("type");
  if (flowType && flowType !== RECOVERY) {
    return {
      kind: "error",
      message: `Expected a recovery link, got type=${flowType}. Use the link sent in the "reset password" email.`,
    };
  }

  // 3. The three credential shapes, in the historical order (implicit fragment first, then PKCE, then verifyOtp).
  if (accessToken && refreshToken) return { kind: "implicit", accessToken, refreshToken };
  if (code) return { kind: "pkce", code };
  if (tokenHash) return { kind: "otp", tokenHash };
  return { kind: "missing" };
}
