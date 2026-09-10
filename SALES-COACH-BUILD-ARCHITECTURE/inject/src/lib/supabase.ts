// supabase.ts — the ONE Supabase client for the whole app (a module singleton; never construct a second).
//
// This is the SAME Supabase project the Elostate web app and browser extension use, so an existing user signs
// in with their current email/password and gets their real coaching data — nothing to re-create, no separate
// account. The client:
//   - persists the session through SecureSessionStore (encrypted; key in the Keychain — see that file),
//   - auto-refreshes the access token (with the AppState wiring below so it refreshes while the app is open),
//   - does NOT parse the URL for a session (that's a web-only OAuth-callback concern).
//
// The `Authorization: Bearer <access_token>` that the coach AI routes expect is just
// `(await supabase.auth.getSession()).data.session?.access_token` — see coach-api.ts. supabase-js owns the
// single-flight refresh + rotation internally, so we do NOT hand-roll the refresh dance the extension had to.

import "react-native-get-random-values"; // MUST be first: polyfills crypto.getRandomValues for the secure store + supabase
import "react-native-url-polyfill/auto"; // supabase-js needs a WHATWG URL on native
import { AppState } from "react-native";
import { createClient } from "@supabase/supabase-js";
import { ENV } from "./env";
import { SecureSessionStore } from "./secure-session-store";

export const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
  auth: {
    storage: SecureSessionStore,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // native app — no URL-based session detection
  },
});

// supabase-js auto-refreshes on a timer, but pauses when JS timers are throttled in the background. Tie the
// refresher to foreground/background so a token never silently goes stale while the app was backgrounded:
// resume refreshing when the app returns to the foreground, stop it when it leaves. (Official RN guidance.)
AppState.addEventListener("change", (state) => {
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

/** The current access token (Bearer) for the coach REST/AI routes, or null if signed out. */
export async function currentAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
