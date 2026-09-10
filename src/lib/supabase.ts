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

/**
 * BUILT ON FIRST USE, NOT AT IMPORT — the owner's decision, 3 September 2026.
 *
 * THE PROBLEM THIS SOLVES. `ENV` throws when a setting is missing, by design.
 * While this file built the client at module scope, that throw happened while
 * `_layout.tsx`'s own imports were still loading — and the app-wide failure
 * screen is exported FROM `_layout`. The module died and took its own safety net
 * with it, so a rep saw the app vanish rather than a sentence telling them what
 * was wrong. The failure screen's own note warns about exactly that shape.
 *
 * Deferring construction moves the throw from IMPORT time to FIRST USE, by which
 * point the tree has mounted and the boundary can catch it. Nothing about the
 * settings check is softened: it is still strict, still throws, still names the
 * variable. It simply happens where somebody can be told.
 *
 * WHY A PROXY. Every call site reads a property — `supabase.from(...)`,
 * `supabase.auth`, `supabase.rpc(...)`. A proxy keeps all of them working
 * untouched; the alternative was editing dozens of call sites into
 * `getSupabase().from(...)`, which is a far larger change to make on the boot
 * path for the same result. Functions are bound to the real client so `this` is
 * never the proxy.
 */
function makeClient() {
  return createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
    auth: {
      storage: SecureSessionStore,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false, // native app — no URL-based session detection
    },
  });
}

/** Derived from the real call, so every row type infers exactly as before. */
type Client = ReturnType<typeof makeClient>;

let client: Client | null = null;

function realClient(): Client {
  if (!client) client = makeClient();
  return client;
}

export const supabase = new Proxy({} as Client, {
  get(_target, prop) {
    const c = realClient() as unknown as Record<string | symbol, unknown>;
    const value = c[prop];
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(c) : value;
  },
  has(_target, prop) {
    return prop in (realClient() as unknown as object);
  },
});

// supabase-js auto-refreshes on a timer, but pauses when JS timers are throttled in the background. Tie the
// refresher to foreground/background so a token never silently goes stale while the app was backgrounded:
// resume refreshing when the app returns to the foreground, stop it when it leaves. (Official RN guidance.)
AppState.addEventListener("change", (state) => {
  // Wrapped because this now TOUCHES the lazy client, and a missing setting
  // throws on that first touch. An app-state handler must never be the thing
  // that crashes the app — the render path will already have surfaced the same
  // failure somewhere a rep can read it.
  try {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  } catch {
    /* settings missing; the screen has already said so */
  }
});

/** The current access token (Bearer) for the coach REST/AI routes, or null if signed out. */
export async function currentAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
