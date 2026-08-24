import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * /dashboard/sales-coach/doors/report-card/latest — jump straight to the rep's MOST RECENT pitch's after-pitch
 * result. Powers the Door Log "View last pitch result" button (founder 2026-08-24): a Macro pitch save is
 * fire-and-forget → the rep returns to IDLE while the result processes async onto the Pitch Performance page,
 * so this resolves "the newest pitch" server-side and redirects to its detail in one tap (no client fetch, no
 * loading flash). A static-segment route: `latest` can never collide with a pitch id (a uuid), and Next.js
 * matches it ahead of the sibling `[pitchId]` route.
 *
 * RLS-scoped (a rep sees only their own pitch). No pitch yet, or a read error, → the Pitch Performance list
 * (its own honest empty / error state) — never a dead end.
 */
export const dynamic = "force-dynamic";

const LIST = "/dashboard/sales-coach/doors/report-card";

export default async function LatestPitchRedirect() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) redirect(LIST); // the list route carries the unauth → login guard

  const { data, error } = await sb
    .from("pitches")
    .select("id")
    .eq("rep_id", auth.user.id)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[report-card/latest] read failed:", error); // CWE-209: log detail, fall back honestly
    redirect(LIST);
  }

  const pitchId = (data?.id as string | undefined) ?? null;
  redirect(pitchId ? `${LIST}/${pitchId}` : LIST);
}
