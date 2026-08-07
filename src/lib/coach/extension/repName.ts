import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Resolve the signed-in rep's display name for the Sales Coach extension routes.
 *
 * Every sales tool route needs the rep's name for the WHO-IS-WHO anchor (the scanned external thread has no
 * per-message role labels, so the engines must be told which side is the rep). This was duplicated verbatim
 * in all 5 routes; centralized here. Best-effort by design: a failed lookup (or a nameless profile) degrades
 * to the generic label rather than blocking the tool — the anchor is a no-op with the generic name, never a
 * fabrication.
 */
export async function resolveRepName(userId: string): Promise<string> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();
    const name = typeof data?.full_name === "string" ? data.full_name.trim() : "";
    return name || "the sales rep";
  } catch {
    return "the sales rep";
  }
}
