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
      return NextResponse.json({
        total: 0,
        noFeedback: 0,
        failed: 0,
        oneSided: 0,
        recoverable: 0,
        lost: 0,
        noFeedbackRate: 0,
        failureRate: 0,
        byAgent: [],
      });
    }

    // The ended sessions + saved-recording pointer + the AGENT (2026-08-13: to break the failure down BY AGENT,
    // so a manager can see WHICH reps get no feedback). Paged (stable uuid id order) so a high-volume company
    // doesn't silently truncate the set the counts are derived from.
    const ended = await fetchAllPaged<{ id: string; audio_asset_url: string | null; agent_id: string | null }>(
      (from, to) =>
        sb
          .from("coaching_sessions")
          .select("id, audio_asset_url, agent_id")
          .eq("company_id", companyId)
          .in("status", ["ended", "reviewed"])
          .order("id")
          .range(from, to),
      { label: "capture-health ended sessions" }
    );
    const endedIds = ended.map((s) => s.id);

    // For each session: does it have ANY segment, and does it have an AGENT segment? (2026-08-13 extension.)
    // The true "no after-pitch feedback" population is sessions with ZERO AGENT turns — the review engine
    // short-circuits to EMPTY at agentSegments < MIN_AGENT_SEGMENTS. The prior version counted only "no
    // transcript at all" and so MISSED the ONE-SIDED case (customer captured, agent's mic not) — which renders
    // no "Your read" yet was counted "captured fine", undercounting the cost. We now split both modes.
    const withAnySegment = new Set<string>();
    const withAgentSegment = new Set<string>();
    for (let i = 0; i < endedIds.length; i += CHUNK) {
      const batch = endedIds.slice(i, i + CHUNK);
      const rows = await fetchAllPaged<{ session_id: string; speaker: string }>(
        (from, to) =>
          sb
            .from("coaching_transcript_segments")
            .select("session_id, speaker, id")
            .in("session_id", batch)
            .order("id")
            .range(from, to),
        { label: "capture-health transcript segments" }
      );
      for (const r of rows) {
        withAnySegment.add(r.session_id);
        if (r.speaker === "agent") withAgentSegment.add(r.session_id);
      }
    }

    // Per-company + per-agent tallies. `noFeedback` = the true count (empty OR one-sided → no "Your read").
    let failed = 0; // no transcript at all (unchanged legacy metric, for continuity)
    let oneSided = 0; // segments present but 0 agent turns (customer captured, agent not)
    let recoverable = 0; // any no-feedback session whose audio was saved → re-transcribable
    let lost = 0; // no-feedback + no audio saved
    const byAgent = new Map<string, { agentId: string; ended: number; noFeedback: number; oneSided: number; empty: number }>();
    const agentBucket = (id: string | null) => {
      const key = id ?? "unassigned";
      let b = byAgent.get(key);
      if (!b) {
        b = { agentId: key, ended: 0, noFeedback: 0, oneSided: 0, empty: 0 };
        byAgent.set(key, b);
      }
      return b;
    };

    for (const s of ended) {
      const bucket = agentBucket(s.agent_id);
      bucket.ended += 1;
      if (withAgentSegment.has(s.id)) continue; // has agent turns → gets after-pitch feedback
      // No agent turns → no "Your read".
      bucket.noFeedback += 1;
      if (withAnySegment.has(s.id)) {
        oneSided += 1;
        bucket.oneSided += 1;
      } else {
        failed += 1; // truly empty transcript
        bucket.empty += 1;
      }
      if (s.audio_asset_url) recoverable += 1;
      else lost += 1;
    }
    const noFeedback = failed + oneSided;

    return NextResponse.json({
      total,
      noFeedback, // TRUE cost: sessions with 0 agent turns → no "Your read" (empty + one-sided)
      failed, // legacy: no transcript at all
      oneSided, // NEW: customer captured, agent's mic not — the missed class
      recoverable, // no-feedback session with audio saved → re-transcribable
      lost, // no-feedback + no audio
      noFeedbackRate: total > 0 ? Math.round((noFeedback / total) * 1000) / 10 : 0,
      failureRate: total > 0 ? Math.round((failed / total) * 1000) / 10 : 0, // legacy (empty-only)
      // Which agents are most affected (highest no-feedback rate first), for targeting the capture problem.
      byAgent: Array.from(byAgent.values())
        .map((b) => ({ ...b, rate: b.ended > 0 ? Math.round((b.noFeedback / b.ended) * 1000) / 10 : 0 }))
        .sort((a, b) => b.rate - a.rate),
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
