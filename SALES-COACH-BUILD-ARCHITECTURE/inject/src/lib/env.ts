// env.ts — the single, typed source of the app's backend coordinates.
//
// WHY a module (not scattered process.env reads): every consumer imports the SAME validated values, and a
// missing var fails LOUD at startup with a message a human can act on — never a silent `undefined` that
// surfaces later as a mystifying auth failure (the §1.5.3 "fail loud, not silent" posture, ported to the app).
//
// Expo exposes only vars prefixed EXPO_PUBLIC_ to the client bundle. These three are wired for you in
// .env.local at the app root (already populated from the live Elostate backend). The Supabase URL and anon key
// are PUBLIC BY DESIGN — the anon key is meant to ship in clients; Row-Level Security is what protects data.
// The service-role key is deliberately NOT here and must never be added to a client build.

function required(name: string, value: string | undefined): string {
  if (!value || !value.trim()) {
    throw new Error(
      `[env] ${name} is missing. Set it in .env.local at the app root (see SALES-COACH-BUILD-ARCHITECTURE/inject/.env.local.example) and restart the Metro bundler with a cleared cache: \`npx expo start -c\`.`,
    );
  }
  return value.trim();
}

export const ENV = {
  /** e.g. https://YOUR-PROJECT.supabase.co — the same Supabase project the web app + extension use (wired in .env.local). */
  SUPABASE_URL: required("EXPO_PUBLIC_SUPABASE_URL", process.env.EXPO_PUBLIC_SUPABASE_URL),
  /** Public anon key. RLS gates every row; this is safe to embed in the app. */
  SUPABASE_ANON_KEY: required("EXPO_PUBLIC_SUPABASE_ANON_KEY", process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
  /** Base URL for the coach REST/AI routes. Defaults to prod; override for local dev. */
  API_BASE: (process.env.EXPO_PUBLIC_API_BASE || "https://elostate.com").replace(/\/+$/, ""),
} as const;
