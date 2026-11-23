import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Set or clear the signed `app_metadata.mfa` flag the guards read (lib/auth/mfa.ts). Service role only — a person can
 * never write their own app_metadata, which is why it, and not user_metadata or the cookie, is the trusted signal.
 * Merges into the existing app_metadata (provider info lives there too). Returns whether it was written.
 */
export async function setMfaFlag(admin: SupabaseClient, userId: string, on: boolean): Promise<boolean> {
  const { data, error: readErr } = await admin.auth.admin.getUserById(userId);
  if (readErr || !data?.user) {
    console.error(`[mfa] flag read failed user=${userId}: ${readErr?.message ?? "no user"}`);
    return false;
  }
  const { error } = await admin.auth.admin.updateUserById(userId, { app_metadata: { ...(data.user.app_metadata ?? {}), mfa: on } });
  if (error) {
    console.error(`[mfa] flag write failed user=${userId}: ${error.message}`);
    return false;
  }
  return true;
}
