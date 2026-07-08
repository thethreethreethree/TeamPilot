import "server-only";
import { dissectCoachV5 } from "@/lib/claude";
import { createAdminClient } from "@/lib/supabase/admin";
import { groundQuote } from "./grounding";
import {
  getCurrentSalesCorpus,
  type TranscriptSegment,
  type SalesContext,
} from "@/lib/data/salesCoach";
import {
  buildSalesPivotSystemPrompt,
  buildSalesPivotUserMessage,
} from "./salesPivotPrompt";

/**
 * Summary-surface PIVOT MOMENT engine (founder 2026-07-07).
 *
 * Reduces a diarized transcript to the SINGLE most decisive turning point, with
 * a DIRECTION — where the rep GAINED or LOST the prospect's interest / trust /
 * potential sale. Distinct from the After-Pitch moment reducer (which lists 3-5
 * moments and flags only a negative breakdown); this is one bidirectional pivot,
 * composed onto the Summarize + Conversation-summary surfaces (§A16 — composes,
 * does not fork the summary engine). Never throws; thin/failed/unground input
 * returns the honest empty state (§3.4).
 *
 * TIMESTAMP HONESTY (§3.4): the model returns which SEGMENT the pivot anchors on
 * (atSeq). THIS engine — not the model — computes the clock offset from that
 * segment's spoken_at relative to the first segment. When spoken_at is absent
 * (e.g. a live-saved transcript stores seq only), timestampLabel is null and the
 * surface shows the pivot WITHOUT a fabricated time.
 */

// §A13 — shapes defined once in summaryTypes; re-exported for existing importers.
export type { PivotDirection, PivotMoment } from "./summaryTypes";
import type { PivotDirection, PivotMoment } from "./summaryTypes";

export type SalesPivot = {
  hasSignal: boolean;
  pivot: PivotMoment | null;
};

const EMPTY: SalesPivot = { hasSignal: false, pivot: null };

const MIN_SEGMENTS = 4; // fewer than this and there isn't a distinct turning point

function mmss(deltaMs: number): string {
  const total = Math.max(0, Math.round(deltaMs / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Generate the pivot AND persist it as an append-only event (§3.1), mirroring
 * runAndStoreSummary so BOTH the on-demand summarize route and the server-side
 * finalize produce it — the Conversation-summary surface then reads it back
 * without an LLM call, and the pivot appears the moment the summary does
 * (workflow continuity, §1.5.1). Manager-visible like the factual summary (the
 * pivot is an observation, not the owner-private score). Best-effort on the
 * event store — the pivot still returns. Returns null when there's no signal.
 */
export async function runAndStorePivot(args: {
  companyId: string;
  actorId: string;
  sessionId: string;
  context?: SalesContext;
  outcome?: string | null;
  segments: TranscriptSegment[];
}): Promise<PivotMoment | null> {
  const result = await generateSalesPivot({
    companyId: args.companyId,
    context: args.context,
    outcome: args.outcome,
    segments: args.segments,
  });
  if (!result.hasSignal || !result.pivot) return null;

  try {
    const admin = createAdminClient();
    await admin.from("events").insert({
      company_id: args.companyId,
      actor: args.actorId,
      kind: "coach.session_pivot_generated",
      subject: `sales_session:${args.sessionId}`,
      payload: { pivot: result.pivot, coach_version: "pivot-v1" },
    });
  } catch {
    /* best-effort — the pivot still returns */
  }
  return result.pivot;
}

export async function generateSalesPivot(args: {
  companyId: string;
  context?: SalesContext;
  outcome?: string | null;
  segments: TranscriptSegment[];
}): Promise<SalesPivot> {
  try {
    if (args.segments.length < MIN_SEGMENTS) return EMPTY;

    const corpus = await getCurrentSalesCorpus(args.companyId).catch(() => null);
    const systemPrompt = buildSalesPivotSystemPrompt(corpus?.content);
    const userMessage = buildSalesPivotUserMessage({
      context: args.context,
      outcome: args.outcome,
      segments: args.segments,
    });

    const r = await dissectCoachV5({
      companyId: args.companyId,
      systemPrompt,
      userMessage,
    });
    if (r.suppressed) return EMPTY;

    return parsePivot(r.text, args.segments) ?? EMPTY;
  } catch {
    return EMPTY;
  }
}

// Exported for test: parsePivot enforces the §3.4 grounding invariant — a pivot
// whose atSeq does not reference a REAL transcript segment is dropped (the coach
// cannot fabricate a moment that isn't in the transcript), the direction must be
// one of the two known values, whatHappened/whyItMattered must be present (an
// ungrounded pivot is not surfaced), timestamps come only from real spoken_at
// (never invented), and malformed model output degrades honestly to empty.
export function parsePivot(
  text: string,
  segments: TranscriptSegment[]
): SalesPivot | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (o.hasSignal === false) return EMPTY;
  if (!o.pivot || typeof o.pivot !== "object") return EMPTY;
  const p = o.pivot as Record<string, unknown>;

  // atSeq must reference a real segment (§3.4 — no fabricated moment).
  const bySeq = new Map<number, TranscriptSegment>();
  for (const s of segments) bySeq.set(s.seq, s);
  const atSeq = typeof p.atSeq === "number" ? p.atSeq : NaN;
  const seg = bySeq.get(atSeq);
  if (!seg) return EMPTY;

  // Direction must be one of the two known values (no third state).
  const direction: PivotDirection | null =
    p.direction === "gained" || p.direction === "lost" ? p.direction : null;
  if (!direction) return EMPTY;

  const whatHappened =
    typeof p.whatHappened === "string" ? p.whatHappened.trim() : "";
  const whyItMattered =
    typeof p.whyItMattered === "string" ? p.whyItMattered.trim() : "";
  // §A11 — a pivot with no explanation is a naked verdict; drop it rather than
  // surface a direction the rep can't inspect.
  if (!whatHappened || !whyItMattered) return EMPTY;

  const label =
    typeof p.label === "string" && p.label.trim()
      ? p.label.trim()
      : direction === "gained"
        ? "Where you gained ground"
        : "Where you lost ground";
  // §3.4 grounding: drop a quote whose words aren't in the transcript (fabrication
  // surfaced to a manager as verbatim). The pivot still stands on its grounded atSeq.
  const customerLine = groundQuote(p.customerLine as string | null, segments);
  const repLine = groundQuote(p.repLine as string | null, segments);

  // Clock offset from real spoken_at only (never invented). Origin = earliest
  // known spoken_at across the transcript, matching the moments engine's clock.
  let originMs: number | null = null;
  for (const s of segments) {
    if (s.spokenAt) {
      const t = Date.parse(s.spokenAt);
      if (!Number.isNaN(t)) {
        originMs = originMs === null ? t : Math.min(originMs, t);
      }
    }
  }
  let timestampLabel: string | null = null;
  if (originMs !== null && seg.spokenAt) {
    const t = Date.parse(seg.spokenAt);
    if (!Number.isNaN(t)) timestampLabel = mmss(t - originMs);
  }

  return {
    hasSignal: true,
    pivot: {
      atSeq,
      timestampLabel,
      direction,
      label,
      customerLine,
      repLine,
      whatHappened,
      whyItMattered,
    },
  };
}
