import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionTranscriptAdmin } from "@/lib/data/salesCoach";
import { runAndStoreDissect } from "@/lib/coach/v5/salesDissect";

/**
 * Shared dissect-backfill core (§A21 — one implementation, two callers):
 *   - POST /api/coach/sales-session/backfill-dissects        (manager, one
 *     company, batch 6, on-demand "Generate missing" button)
 *   - GET  /api/coach/sales-session/backfill-dissects-cron   (Vercel cron,
 *     ALL companies, cap 12/day, CRON_SECRET auth)
 *
 * Finds Sales Coach sessions with content (ended/reviewed) but NO
 * coach.dissect_generated event and regenerates a CAPPED batch, each dissect
 * attributed to the SESSION'S agent (§A18). Thin sessions short-circuit
 * inside runAndStoreDissect before any LLM call (§3.4 — no fabrication) and
 * are simply re-checked next run.
 *
 * §5 — the cap bounds LLM cost + function time per run; a large backlog
 * drains over several runs rather than one expensive burst. §3.4 — the scan
 * is bounded (SCAN_LIMIT most-recent sessions); anything older still un-
 * dissected is reported via `scanBounded` rather than silently dropped.
 */

// All-company scans a wider window than a single company; both are bounded.
const SCAN_LIMIT_SCOPED = 300;
const SCAN_LIMIT_ALL = 1000;

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
    .select("id, agent_id, company_id, client_label, context, status")
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

  const missing = sessions.filter((s) => !dissected.has(s.id as string));
  const batch = missing.slice(0, args.cap);

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
      const dissect = await runAndStoreDissect({
        companyId: s.company_id as string,
        actorId: s.agent_id as string,
        sessionId: s.id as string,
        segments,
        sessionTitle: (s.client_label as string | null) ?? undefined,
        context: s.context as "in_person" | "video",
      }).catch(() => null);
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
