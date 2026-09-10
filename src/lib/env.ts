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

/**
 * READ ON ACCESS, NOT ON IMPORT — and this is the boot-crash decision, finished.
 *
 * These were plain properties, so `required()` ran while this MODULE was being
 * evaluated. Importing it was enough to throw, and the import chain from the
 * root layout is short: `_layout.tsx` -> `auth-context` -> `supabase` -> here.
 * A module that throws while the root layout is still loading cannot be caught
 * by the root layout's own ErrorBoundary — the boundary is a component in a tree
 * that never got built. A rep with a mis-built app saw it close itself.
 *
 * The owner chose `lazy-client` for exactly this, and the Supabase client was
 * made lazy — but the client was never what threw. THIS was. Deferring the
 * client while leaving the values eager fixed the half that was not broken.
 *
 * As getters, the check runs at the first property READ, which happens inside
 * `makeClient()` inside the client proxy — during render or an effect, where an
 * ErrorBoundary is mounted and can show a screen that names the missing setting.
 *
 * Metro inlines `process.env.EXPO_PUBLIC_*` at build time, so reading it inside
 * a getter is the same substitution it was outside one. Nothing about how the
 * values reach the bundle changes; only WHEN they are checked.
 */
export const ENV = {
  /** e.g. https://YOUR-PROJECT.supabase.co — the same Supabase project the web app + extension use (wired in .env.local). */
  get SUPABASE_URL(): string {
    return required("EXPO_PUBLIC_SUPABASE_URL", process.env.EXPO_PUBLIC_SUPABASE_URL);
  },
  /** Public anon key. RLS gates every row; this is safe to embed in the app. */
  get SUPABASE_ANON_KEY(): string {
    return required("EXPO_PUBLIC_SUPABASE_ANON_KEY", process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
  },
  /** Base URL for the coach REST/AI routes. Defaults to prod; override for local dev. */
  get API_BASE(): string {
    return (process.env.EXPO_PUBLIC_API_BASE || "https://elostate.com").replace(/\/+$/, "");
  },
} as const;
