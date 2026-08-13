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
        undecided: 0,
        customerLabeled: 0,
        customerMissing: 0,
        recoverable: 0,
        lost: 0,
        noFeedbackRate: 0,
        customerMissingRate: 0,
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
    // Speaker distribution per session (2026-08-13 refine — distinguish a fixable LABELING failure from a true
    // capture failure, so we don't rebuild the STT for a mislabeling bug). speaker ∈ agent|customer|unknown
    // (migration 0070). A no-feedback session with `unknown` segments = the attribution FAILED TO DECIDE (fixable
    // in code); all-`customer` = mis-attribution OR true one-sided; no segments = the STT captured nothing.
    const withAnySegment = new Set<string>();
    const withAgentSegment = new Set<string>();
    const withCustomerSegment = new Set<string>();
    const withUnknownSegment = new Set<string>();
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
        else if (r.speaker === "customer") withCustomerSegment.add(r.session_id);
        else if (r.speaker === "unknown") withUnknownSegment.add(r.session_id);
      }
    }

    // Per-company + per-agent tallies. `noFeedback` = the true count (0 agent turns → no "Your read"), split by
    // CAUSE so the fix can be chosen correctly: empty (STT captured nothing), undecided (attribution left turns
    // `unknown` → FIXABLE in code), customerLabeled (all customer → mis-attribution OR true one-sided).
    let failed = 0; // no transcript at all (== `empty`; legacy name kept for continuity)
    let undecided = 0; // segments present, 0 agent, ≥1 `unknown` → attribution failed to decide (fixable)
    let customerLabeled = 0; // segments present, 0 agent, all customer → mis-attribution or true one-sided
    // agent present but the CUSTOMER side absent → the written read is blank DESPITE scores (the 2026-08-14
    // customer-missing capture class). It's NOT in the 0-agent `noFeedback` population — the metric was blind to
    // it before (it only counted 0-agent sessions), undercounting the capture cost. Now surfaced as its own bucket.
    let customerMissing = 0;
    let recoverable = 0; // any no-feedback session whose audio was saved → re-transcribable
    let lost = 0; // no-feedback + no audio saved
    const byAgent = new Map<
      string,
      { agentId: string; ended: number; noFeedback: number; oneSided: number; empty: number; undecided: number; customerLabeled: number; customerMissing: number }
    >();
    const agentBucket = (id: string | null) => {
      const key = id ?? "unassigned";
      let b = byAgent.get(key);
      if (!b) {
        b = { agentId: key, ended: 0, noFeedback: 0, oneSided: 0, empty: 0, undecided: 0, customerLabeled: 0, customerMissing: 0 };
        byAgent.set(key, b);
      }
      return b;
    };

    for (const s of ended) {
      const bucket = agentBucket(s.agent_id);
      bucket.ended += 1;
      if (withAgentSegment.has(s.id)) {
        // Has agent turns → the scores compute. But if the CUSTOMER side is absent, the written read is blank
        // despite the scores (talk/listen "—") — the customer-missing capture class auto-recover targets. Count
        // it here so the metric sees it; it's outside the 0-agent `noFeedback` population by construction.
        if (!withCustomerSegment.has(s.id)) {
          customerMissing += 1;
          bucket.customerMissing += 1;
        }
        continue; // has agent turns → not in the 0-agent no-feedback population below
      }
      // No agent turns → no "Your read".
      bucket.noFeedback += 1;
      if (!withAnySegment.has(s.id)) {
        failed += 1; // truly empty transcript — STT captured nothing
        bucket.empty += 1;
      } else if (withUnknownSegment.has(s.id)) {
        undecided += 1; // has `unknown` segments → attribution failed to decide → FIXABLE in code
        bucket.undecided += 1;
        bucket.oneSided += 1;
      } else {
        customerLabeled += 1; // all customer → mis-attribution or true one-sided
        bucket.customerLabeled += 1;
        bucket.oneSided += 1;
      }
      if (s.audio_asset_url) recoverable += 1;
      else lost += 1;
    }
    const oneSided = undecided + customerLabeled;
    const noFeedback = failed + oneSided;

    // Resolve NAMES for the affected agents (a UUID isn't actionable — the founder wants to know WHO). Only the
    // reps with no-feedback sessions, company-scoped via RLS. Best-effort: a lookup miss just leaves the id.
    const affectedIds = Array.from(byAgent.values())
      .filter((b) => (b.noFeedback > 0 || b.customerMissing > 0) && b.agentId !== "unassigned")
      .map((b) => b.agentId);
    const nameById = new Map<string, string>();
    if (affectedIds.length > 0) {
      const { data: profs } = await sb.from("profiles").select("id, full_name").in("id", affectedIds);
      for (const p of profs ?? []) {
        const n = (p.full_name as string | null)?.trim();
        if (n) nameById.set(p.id as string, n);
      }
    }

    return NextResponse.json({
      total,
      noFeedback, // TRUE cost: sessions with 0 agent turns → no "Your read"
      failed, // == empty: no transcript at all (STT captured nothing)
      oneSided, // segments present, 0 agent turns (= undecided + customerLabeled)
      undecided, // segments present, ≥1 `unknown` → attribution failed → FIXABLE IN CODE (no STT swap needed)
      customerLabeled, // segments present, all customer → mis-attribution or true one-sided
      customerMissing, // agent present but customer side absent → blank read DESPITE scores (auto-recover class)
      recoverable, // no-feedback session with audio saved → re-transcribable
      lost, // no-feedback + no audio
      noFeedbackRate: total > 0 ? Math.round((noFeedback / total) * 1000) / 10 : 0,
      customerMissingRate: total > 0 ? Math.round((customerMissing / total) * 1000) / 10 : 0,
      failureRate: total > 0 ? Math.round((failed / total) * 1000) / 10 : 0, // legacy (empty-only)
      // Which agents are most affected (highest no-feedback rate first), for targeting the capture problem.
      byAgent: Array.from(byAgent.values())
        .map((b) => ({
          ...b,
          agentName: nameById.get(b.agentId) ?? null,
          rate: b.ended > 0 ? Math.round((b.noFeedback / b.ended) * 1000) / 10 : 0,
        }))
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
