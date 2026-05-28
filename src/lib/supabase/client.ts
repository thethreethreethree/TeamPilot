import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseEnabled } from "./config";

/** Supabase client for use in Client Components. Throws if env vars are missing. */
export function createClient() {
  if (!supabaseEnabled) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local."
    );
  }
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export { supabaseEnabled };
