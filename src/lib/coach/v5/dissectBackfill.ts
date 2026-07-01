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

  // Which of these already have a dissect event.
  let eq = admin
    .from("events")
    .select("subject")
    .eq("kind", "coach.dissect_generated");
  if (args.companyId) eq = eq.eq("company_id", args.companyId);
  const { data: dissectEvents, error: eErr } = await eq;
  if (eErr) throw new Error(`events: ${eErr.message}`);
  const dissected = new Set(
    (dissectEvents ?? []).map((e) =>
      String(e.subject ?? "").replace("sales_session:", "")
    )
  );

  const missing = sessions.filter((s) => !dissected.has(s.id as string));
  const batch = missing.slice(0, args.cap);

  let generated = 0;
  let thinOrFailed = 0;
  for (const s of batch) {
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
    if (dissect?.hasSignal) generated += 1;
    else thinOrFailed += 1;
  }

  return {
    missingTotal: missing.length,
    processed: batch.length,
    generated,
    thinOrFailed,
    remaining: Math.max(0, missing.length - batch.length),
    scanBounded: sessions.length >= scanLimit,
  };
}
