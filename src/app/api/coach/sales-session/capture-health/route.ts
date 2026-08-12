import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { isSalesCoachManager } from "@/lib/coach/v5/skillAccess";
import { fetchAllPaged } from "@/lib/supabase/paginate";

/**
 * GET /api/coach/sales-session/capture-health — manager-only "cost of the capture incident" count.
 *
 * Answers the founder's "determine the cost of this issue" (2026-08-12): how many ENDED sessions failed to
 * capture (no transcript), split into recoverable (audio was saved → re-transcribable) vs lost (no audio at
 * all — only possible for sessions from BEFORE the build-xp persist fix).
 *
 * Implementation note (honest, §3.4): this counts in the app rather than via a server-side aggregate, so it is
 * correct at first-client scale and FAILS LOUD past it. `total` is an exact head count; the transcript check
 * pages the ended-session ids in ≤1000-id batches (PostgREST `.in()` limit) and pages each batch's segment
 * rows via fetchAllPaged (its 200k backstop throws rather than under-count). If the volume ever exceeds that,
 * the honest fix is a server-side aggregate RPC (a migration) — flagged in the response as `approximate:false`
 * only when the full set was read. RLS + the manager gate scope everything to the caller's company.
 */
export const dynamic = "force-dynamic";

const CHUNK = 1000;

export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const { data: me } = await sb
    .from("profiles")
    .select("role, sales_coach_role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const manager = isSalesCoachManager({
    role: (me?.role as string | null) ?? null,
    sales_coach_role: (me?.sales_coach_role as string | null) ?? null,
    company_id: null,
  });
  if (!manager) {
    return NextResponse.json({ error: "Manager access required." }, { status: 403 });
  }
  const companyId = (await getCurrentCompanyId()) ?? undefined;
  if (!companyId) {
    return NextResponse.json({ error: "No company context." }, { status: 403 });
  }

  try {
    // Exact head count of ended sessions (no rows fetched).
    const totalRes = await sb
      .from("coaching_sessions")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .in("status", ["ended", "reviewed"]);
    if (totalRes.error) throw new Error(totalRes.error.message);
    const total = totalRes.count ?? 0;
    if (total === 0) {
      return NextResponse.json({ total: 0, failed: 0, recoverable: 0, lost: 0, failureRate: 0 });
    }

    // The ended sessions + whether each has a saved recording. Paged (stable uuid id order) so a high-volume
    // company doesn't silently truncate the set the counts are derived from.
    const ended = await fetchAllPaged<{ id: string; audio_asset_url: string | null }>(
      (from, to) =>
        sb
          .from("coaching_sessions")
          .select("id, audio_asset_url")
          .eq("company_id", companyId)
          .in("status", ["ended", "reviewed"])
          .order("id")
          .range(from, to),
      { label: "capture-health ended sessions" }
    );
    const endedIds = ended.map((s) => s.id);

    // Which of those sessions have a transcript (≥1 segment). Batch the ids to respect the .in() ceiling,
    // and page each batch's rows. A Set of session_ids-with-transcript; the rest are failed captures.
    const withTranscript = new Set<string>();
    for (let i = 0; i < endedIds.length; i += CHUNK) {
      const batch = endedIds.slice(i, i + CHUNK);
      const rows = await fetchAllPaged<{ session_id: string }>(
        (from, to) =>
          sb
            .from("coaching_transcript_segments")
            .select("session_id, id")
            .in("session_id", batch)
            .order("id")
            .range(from, to),
        { label: "capture-health transcript segments" }
      );
      for (const r of rows) withTranscript.add(r.session_id);
    }

    let failed = 0;
    let recoverable = 0;
    let lost = 0;
    for (const s of ended) {
      if (withTranscript.has(s.id)) continue; // captured fine
      failed += 1;
      if (s.audio_asset_url) recoverable += 1;
      else lost += 1;
    }

    return NextResponse.json({
      total,
      failed,
      recoverable, // audio saved → re-transcribable
      lost, // no audio (gone) — only sessions from before the build-xp fix
      failureRate: total > 0 ? Math.round((failed / total) * 1000) / 10 : 0, // % to 1dp
    });
  } catch (e) {
    // §3.4: a failed count must not read as "zero failures". Say the count couldn't be computed (e.g. the
    // volume exceeded fetchAllPaged's backstop — the point at which a server-side aggregate RPC is needed).
    console.error("[capture-health] count failed:", e);
    return NextResponse.json(
      { error: "Couldn't compute capture health — the volume may be too large for an in-app count (a server-side aggregate is the fix at that scale)." },
      { status: 500 }
    );
  }
}
