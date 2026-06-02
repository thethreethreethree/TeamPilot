import "server-only";
import { createClient } from "./server";

/**
 * Server-side helper: resolve the current authenticated user's company id.
 * Returns null when in demo mode (Supabase not configured) or when the user
 * has not yet completed onboarding.
 */
export async function getCurrentCompanyId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return null;
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", auth.user.id)
      .maybeSingle();
    return profile?.company_id ?? null;
  } catch {
    return null;
  }
}
