import { safeRelativePath } from "@/lib/nav/safeRedirect";

/**
 * Google and Microsoft sign-in (RSS Phase 9; Gong F1.2) — through Supabase OAuth.
 *
 * EXTERNAL CONFIG FIRST (CLAUDE.md §1.5.3; docs/AUTH-REDIRECTS.md "OAuth providers"). A provider works only once it is
 * set up in the Supabase dashboard (client id + secret from Google Cloud / Microsoft Entra) and the callback URL is on
 * the Redirect URLs allowlist. Until the operator says so in NEXT_PUBLIC_AUTH_PROVIDERS, no button is shown: a button
 * for an unconfigured provider would send a customer to a Supabase error page.
 */
export const OAUTH_PROVIDERS = {
  google: { label: "Continue with Google", supabase: "google" as const, scopes: undefined },
  // Supabase calls Microsoft "azure"; `email` is needed for Entra accounts to return an address.
  azure: { label: "Continue with Microsoft", supabase: "azure" as const, scopes: "email" },
} as const;
export type OAuthProviderKey = keyof typeof OAUTH_PROVIDERS;

/** The providers the operator has declared configured, in a fixed order. Unknown names are ignored. */
export function enabledProviders(raw = process.env.NEXT_PUBLIC_AUTH_PROVIDERS): OAuthProviderKey[] {
  const want = new Set(String(raw ?? "").split(",").map((s) => s.trim().toLowerCase()));
  if (want.has("microsoft")) want.add("azure");
  return (Object.keys(OAUTH_PROVIDERS) as OAuthProviderKey[]).filter((k) => want.has(k));
}

/** Where to land after sign-in: the app's one open-redirect guard (safeRelativePath), defaulting to /dashboard. */
export function safeNext(next: string | null | undefined, fallback = "/dashboard"): string {
  return safeRelativePath(next) ?? fallback;
}

/**
 * Why a sign-in came back to /login. CODES only, mapped to fixed sentences on the page: printing a ?error= text as
 * given would let anyone send a link that shows their own words on our sign-in page.
 */
export const OAUTH_ERRORS = {
  oauth_cancelled: "The sign-in was cancelled or refused. Try again, or use your email and password.",
  oauth_incomplete: "That sign-in link is incomplete. Try again.",
  oauth_failed: "That sign-in didn't complete. Try again.",
} as const;
export function oauthErrorMessage(code: string | null | undefined): string {
  return code && code in OAUTH_ERRORS ? OAUTH_ERRORS[code as keyof typeof OAUTH_ERRORS] : "";
}
