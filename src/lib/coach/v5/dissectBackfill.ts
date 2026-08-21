import "server-only";
import type { SalesSession } from "@/lib/data/salesCoach";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionTranscriptAdmin } from "@/lib/data/salesCoach";
import { generateSessionArtifacts } from "@/lib/coach/v5/generateSessionArtifacts";
import { generateAndStoreAfterPitch } from "@/lib/coach/v5/generateAndStoreAfterPitch";

/**
 * Shared session-review backfill core (§A21 — one implementation, two callers):
 *   - POST /api/coach/sales-session/backfill-dissects        (manager, one
 *     company, batch, on-demand "Generate missing" button)
 *   - GET  /api/coach/sales-session/backfill-dissects-cron   (Vercel cron,
 *     ALL companies, capped/run, CRON_SECRET auth)
 *
 * Finds Sales Coach sessions with content (ended/reviewed) but NO
 * coach.dissect_generated event and regenerates a CAPPED batch, each artifact
 * attributed to the SESSION'S agent (§A18). Thin sessions short-circuit
 * inside the engines before any LLM call (§3.4 — no fabrication) and are
 * simply re-checked next run.
 *
 * P1 (2026-08-21 capture audit): this now regenerates the FULL review set via
 * generateSessionArtifacts (Dissect + Summary + Timeline/Moments + Pivot +
 * Intel), not just the Dissect. A session that was never cleanly Stopped
 * (tab-close → auto-closed at 6h) missed /finalize entirely, so ALL of those
 * artifacts are absent — not only the dissect. The dissect_generated marker is
 * still the "has this session been reviewed?" key (it's written iff the dissect
 * has signal), so eligibility/backoff are unchanged; what grew is what a single
 * recovery produces.
 *
 * §5 — the cap bounds LLM cost + function time per run; a large backlog
 * drains over several runs rather than one expensive burst. §3.4 — the scan
 * is bounded (SCAN_LIMIT most-recent sessions); anything older still un-
 * dissected is reported via `scanBounded` rather than silently dropped.
 */

// All-company scans a wider window than a single company; both are bounded.
const SCAN_LIMIT_SCOPED = 300;
const SCAN_LIMIT_ALL = 1000;

// Backoff window for a session that RAN the LLM but produced no signal (starved / tone-law / empty-with-turns).
// It never gets a coach.dissect_generated marker, so without a backoff it would be re-run with a full LLM call
// every pass forever (cron cap burn + the manual button's "remaining" frozen above 0). We emit a
// coach.dissect_attempted marker (salesDissect.runAndStoreDissect) and skip such a session for this many days —
// long enough to bound cost, short enough that a corpus-trim can recover it on the next window. (Founder-chosen
// N=14, 2026-08-14.)
const ATTEMPT_BACKOFF_DAYS = 14;

export type DissectBackfillResult = {
  missingTotal: number;
  processed: number;
  generated: number;
  thinOrFailed: number;
  remaining: number;
  // True when the session scan hit its limit — there may be older un-
  // dissected sessions beyond the window (honest bound, §3.4).
  scanBounded: boolean;
};

export async function runDissectBackfill(args: {
  /** null/undefined = all companies (cron); a value = that company (manual). */
  companyId?: string | null;
  cap: number;
}): Promise<DissectBackfillResult> {
  const admin = createAdminClient();
  const scoped = Boolean(args.companyId);
  const scanLimit = scoped ? SCAN_LIMIT_SCOPED : SCAN_LIMIT_ALL;

  // Sessions with content, most recent first.
  let sq = admin
    .from("coaching_sessions")
    .select("id, agent_id, company_id, client_label, context, status, outcome")
    .in("status", ["ended", "reviewed"])
    .order("started_at", { ascending: false })
    .limit(scanLimit);
  if (args.companyId) sq = sq.eq("company_id", args.companyId);
  const { data: sessionsData, error: sErr } = await sq;
  if (sErr) throw new Error(`sessions: ${sErr.message}`);
  const sessions = sessionsData ?? [];

  // F4 (§5) — bound the events diff to EXACTLY the sessions scanned (never a
  // full all-companies scan of every dissect event ever). Mirrors the
  // Sessions-list route's bounded .in("subject", subjects) diff.
  const emptyResult: DissectBackfillResult = {
    missingTotal: 0,
    processed: 0,
    generated: 0,
    thinOrFailed: 0,
    remaining: 0,
    scanBounded: sessions.length >= scanLimit,
  };
  if (sessions.length === 0) return emptyResult;
  const subjects = sessions.map((s) => `sales_session:${s.id}`);

  // Which of these already have a dissect event.
  const { data: dissectEvents, error: eErr } = await admin
    .from("events")
    .select("subject")
    .eq("kind", "coach.dissect_generated")
    .in("subject", subjects);
  if (eErr) throw new Error(`events: ${eErr.message}`);
  const dissected = new Set(
    (dissectEvents ?? []).map((e) =>
      String(e.subject ?? "").replace("sales_session:", "")
    )
  );

  // Which of these were ATTEMPTED (LLM ran, no signal) within the backoff window — skip them so a persistently
  // no-signal session isn't re-run with a full LLM call every pass. They re-enter the set after the window, so a
  // later corpus-trim can still recover them. Same bounded-diff discipline as the dissect-event query above.
  const attemptCutoff = new Date(
    Date.now() - ATTEMPT_BACKOFF_DAYS * 86_400_000
  ).toISOString();
  const { data: attemptEvents, error: aErr } = await admin
    .from("events")
    .select("subject")
    .eq("kind", "coach.dissect_attempted")
    .in("subject", subjects)
    .gte("occurred_at", attemptCutoff);
  if (aErr) throw new Error(`attempt events: ${aErr.message}`);
  const recentlyAttempted = new Set(
    (attemptEvents ?? []).map((e) =>
      String(e.subject ?? "").replace("sales_session:", "")
    )
  );

  const missing = sessions.filter(
    (s) => !dissected.has(s.id as string) && !recentlyAttempted.has(s.id as string)
  );
  const batch = missing.slice(0, args.cap);

  // Which of the batch ALREADY have an After-Pitch summary (generated on-view) — skip regenerating those, so a
  // backfill never duplicates an existing summary (after_pitch_summaries is insert-only, read-latest). Same
  // bounded-diff discipline as the dissect-event query above.
  const batchIds = batch.map((s) => s.id as string);
  const hasAfterPitch = new Set<string>();
  if (batchIds.length > 0) {
    const { data: apRows } = await admin
      .from("after_pitch_summaries")
      .select("session_id")
      .in("session_id", batchIds);
    for (const r of apRows ?? []) hasAfterPitch.add(String(r.session_id));
  }

  // PARALLEL, not sequential. Each dissect is an independent LLM call on a different session (no shared
  // state), and the active reasoning model (deepseek-v4-flash) now spends ~15–25s PER dissect — so a
  // sequential batch of `cap` (6) would run ~90–120s and blow the 60s maxDuration, timing out mid-batch.
  // Running the batch concurrently makes wall-clock ≈ the slowest single dissect (~25s), well under 60s, so
  // one "Generate missing" click cleanly completes a full batch instead of a timed-out partial one. Failures
  // are caught per-item (a thin/failed session just isn't counted and reappears in the next batch).
  const outcomes = await Promise.all(
    batch.map(async (s) => {
      // Service-role transcript read — works with or without a user session.
      const segments = await getSessionTranscriptAdmin(s.id as string);
      // Recover the FULL review set, not just the dissect (see header) — same 5-engine generator /finalize
      // runs, each engine self-storing + independently guarded, so a partial failure still lands what it can.
      // dissect.hasSignal is still the "was it reviewed?" signal (drives the generated count + the marker).
      const { dissect } = await generateSessionArtifacts({
        companyId: s.company_id as string,
        actorId: s.agent_id as string,
        sessionId: s.id as string,
        session: {
          clientLabel: (s.client_label as string | null) ?? null,
          context: s.context as "in_person" | "video",
          outcome: (s.outcome as SalesSession["outcome"]) ?? null,
        },
        segments,
      }).catch(() => ({ dissect: null }));
      // Also recover the After-Pitch summary (founder P1) unless one already exists — it's generated on-view,
      // so a never-viewed session has none. Best-effort + self-gating (a thin/one-sided transcript stores
      // nothing). No viewer in a backfill, so attribute the coarse event to the rep. Never blocks the 5
      // artifacts above, which have already landed.
      if (!hasAfterPitch.has(s.id as string)) {
        await generateAndStoreAfterPitch({
          companyId: s.company_id as string,
          sessionId: s.id as string,
          agentId: s.agent_id as string,
          actorId: s.agent_id as string,
          context: s.context as "in_person" | "video",
          outcome: (s.outcome as string | null) ?? null,
        }).catch(() => {
          /* best-effort — the 5 artifacts already landed */
        });
      }
      return dissect?.hasSignal === true;
    })
  );
  const generated = outcomes.filter(Boolean).length;
  const thinOrFailed = outcomes.length - generated;

  return {
    missingTotal: missing.length,
    processed: batch.length,
    generated,
    thinOrFailed,
    remaining: Math.max(0, missing.length - batch.length),
    scanBounded: sessions.length >= scanLimit,
  };
}
