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
  buildSalesMomentsSystemPrompt,
  buildSalesMomentsUserMessage,
} from "./salesMomentsPrompt";

/**
 * After Pitch Summary — MOMENT REDUCER engine.
 *
 * Reduces a diarized transcript to the timeline hero (3-5 key moments,
 * ≤1 breakdown). Composes with the existing coach engines (§A21 — same LLM
 * path, same honest empty-state contract as generateSalesReview). Never
 * throws; on failure or thin input returns the honest empty state (§3.4).
 *
 * TIMESTAMP HONESTY (§3.4): the model returns which SEGMENT each moment
 * anchors on (atSeq). THIS engine — not the model — computes the clock offset
 * from that segment's spoken_at relative to the first segment. When spoken_at
 * is absent (e.g. a live-saved transcript stores seq only), timestampLabel is
 * null and the surface shows the ordered moment WITHOUT a fabricated time.
 */

// §A13 — the shapes live in ONE place (summaryTypes) and are re-exported here so
// existing importers (routes, tests) keep working and the client can share them.
export type {
  MomentKind,
  MomentCorrection,
  SalesMoment,
} from "./summaryTypes";
import type {
  MomentKind,
  MomentCorrection,
  SalesMoment,
} from "./summaryTypes";

export type SalesMoments = {
  hasSignal: boolean;
  moments: SalesMoment[];
};

const EMPTY: SalesMoments = { hasSignal: false, moments: [] };

const MIN_SEGMENTS = 4; // fewer than this and there aren't distinct moments

function mmss(deltaMs: number): string {
  const total = Math.max(0, Math.round(deltaMs / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Generate the Conversation Timeline (3-5 key moments) AND persist it as an
 * append-only event (§3.1), mirroring runAndStoreSummary/runAndStorePivot so
 * BOTH the on-demand summarize route and the server-side finalize produce it.
 * The Conversation-summary + Summarize surfaces then read it back without an LLM
 * call, and the timeline appears the moment the summary does (workflow
 * continuity, §1.5.1). Manager-visible like the summary + pivot (the timeline is
 * an observation of the call, founder decision 2026-07-07). Best-effort on the
 * event store — the timeline still returns. Returns [] when there's no signal.
 */
export async function runAndStoreMoments(args: {
  companyId: string;
  actorId: string;
  sessionId: string;
  context?: SalesContext;
  outcome?: string | null;
  segments: TranscriptSegment[];
}): Promise<SalesMoment[]> {
  const result = await generateSalesMoments({
    companyId: args.companyId,
    context: args.context,
    outcome: args.outcome,
    segments: args.segments,
  });
  if (!result.hasSignal || result.moments.length === 0) return [];

  try {
    const admin = createAdminClient();
    await admin.from("events").insert({
      company_id: args.companyId,
      actor: args.actorId,
      kind: "coach.session_moments_generated",
      subject: `sales_session:${args.sessionId}`,
      payload: { moments: result.moments, coach_version: "moments-v1" },
    });
  } catch {
    /* best-effort — the timeline still returns */
  }
  return result.moments;
}

export async function generateSalesMoments(args: {
  companyId: string;
  context?: SalesContext;
  outcome?: string | null;
  segments: TranscriptSegment[];
}): Promise<SalesMoments> {
  try {
    if (args.segments.length < MIN_SEGMENTS) return EMPTY;

    const corpus = await getCurrentSalesCorpus(args.companyId).catch(() => null);
    const systemPrompt = buildSalesMomentsSystemPrompt(corpus?.content);
    const userMessage = buildSalesMomentsUserMessage({
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

    return parseMoments(r.text, args.segments) ?? EMPTY;
  } catch {
    return EMPTY;
  }
}

// Exported for test: parseMoments enforces the §3.4 grounding invariant — a
// moment whose atSeq does not reference a REAL transcript segment is dropped
// (the coach cannot fabricate a moment that isn't in the transcript), timestamps
// come only from real spoken_at (never invented), and malformed model output
// degrades honestly. These are constitutional invariants worth pinning.
export function parseMoments(
  text: string,
  segments: TranscriptSegment[]
): SalesMoments | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (o.hasSignal === false) return EMPTY;
  if (!Array.isArray(o.moments)) return EMPTY;

  // Index segments by seq for atSeq validation + timestamp computation.
  const bySeq = new Map<number, TranscriptSegment>();
  for (const s of segments) bySeq.set(s.seq, s);

  // The earliest known spoken_at is the timeline origin. If none is known,
  // every timestampLabel stays null (honest — we don't fabricate a clock).
  let originMs: number | null = null;
  for (const s of segments) {
    if (s.spokenAt) {
      const t = Date.parse(s.spokenAt);
      if (!Number.isNaN(t)) {
        originMs = originMs === null ? t : Math.min(originMs, t);
      }
    }
  }

  const kinds: MomentKind[] = [
    "opener",
    "discovery",
    "objection",
    "breakdown",
    "close",
    "other",
  ];
  const out: SalesMoment[] = [];
  let breakdownTaken = false;

  for (const item of o.moments) {
    if (!item || typeof item !== "object") continue;
    const m = item as Record<string, unknown>;
    const atSeq = typeof m.atSeq === "number" ? m.atSeq : NaN;
    const seg = bySeq.get(atSeq);
    if (!seg) continue; // atSeq must reference a real segment (§3.4)

    let kind = kinds.includes(m.kind as MomentKind)
      ? (m.kind as MomentKind)
      : "other";
    const label =
      typeof m.label === "string" && m.label.trim() ? m.label.trim() : kind;
    // §3.4 grounding: the quote must actually appear in the transcript, or it's a
    // fabrication surfaced to a manager as a verbatim, timestamped statement. Ground
    // the WORDS (punctuation-insensitive); drop the string if unverifiable — the
    // moment still stands on its grounded atSeq.
    const customerLine = groundQuote(m.customerLine as string | null, segments);
    const repLine = groundQuote(m.repLine as string | null, segments);
    const note =
      typeof m.note === "string" && m.note.trim() ? m.note.trim() : null;
    const sentiment =
      m.sentiment === "warming" || m.sentiment === "cooling"
        ? m.sentiment
        : "neutral";

    // At most ONE breakdown (the pivotal one). A second flagged breakdown is
    // demoted to 'other' — the timeline highlights a single turning point.
    const isBreakdown = m.isBreakdown === true && !breakdownTaken;
    if (isBreakdown) breakdownTaken = true;
    // The 'breakdown' KIND must also demote — otherwise a second moment the model
    // labelled kind:'breakdown' keeps that kind even though its isBreakdown flag was
    // cleared, so surfaces/logic keyed on kind==='breakdown' would see TWO (the bug
    // the comment above promised was fixed). Only the single taken breakdown keeps it.
    if (kind === "breakdown" && !isBreakdown) kind = "other";

    let correction: MomentCorrection | null = null;
    if (isBreakdown && m.correction && typeof m.correction === "object") {
      const c = m.correction as Record<string, unknown>;
      const correctLine =
        typeof c.correctLine === "string" ? c.correctLine.trim() : "";
      const whyItWorks =
        typeof c.whyItWorks === "string" ? c.whyItWorks.trim() : "";
      if (correctLine && whyItWorks) correction = { correctLine, whyItWorks };
    }

    // Compute the clock offset from real spoken_at (never invented).
    let timestampLabel: string | null = null;
    if (originMs !== null && seg.spokenAt) {
      const t = Date.parse(seg.spokenAt);
      if (!Number.isNaN(t)) timestampLabel = mmss(t - originMs);
    }

    out.push({
      atSeq,
      timestampLabel,
      kind: isBreakdown ? "breakdown" : kind,
      label,
      customerLine,
      repLine,
      note,
      isBreakdown,
      correction,
      sentiment,
    });
  }

  if (out.length === 0) return EMPTY;
  // Chronological by segment order.
  out.sort((a, b) => a.atSeq - b.atSeq);
  return { hasSignal: true, moments: out.slice(0, 5) };
}
