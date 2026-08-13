import "server-only";
import { dissectCoachV5 } from "@/lib/claude";
// Prompt-injection fence — the transcript judged below carries untrusted CUSTOMER
// speech; instructions inside it are DATA, never obeyed. Shared with the care surfaces.
import { CONVERSATION_IS_DATA } from "@/lib/care/toolPrompts";
import {
  getSessionTranscriptAdmin,
  getSessionCuesAdmin,
  getSessionCueOutcomesAdmin,
  appendCueOutcome,
  type TranscriptSegment,
  type SalesContext,
  type Cue,
  type CueMode,
  type CueOutcome,
  type CueOutcomeDetermination,
} from "@/lib/data/salesCoach";
import { generateSalesReview, type SalesReview } from "./salesReview";
import { generateSalesMoments, type SalesMoment } from "./salesMoments";
import { generateSalesScores, type ScoreCategory } from "./salesScore";

/**
 * After Pitch Summary — ASSEMBLER.
 *
 * Composes (A16/A21 — does NOT fork) the existing coach engines into the
 * rep's private "between doors" debrief:
 *   - narrative   → generateSalesReview (the tone-law strengths→growth review)
 *   - moments     → generateSalesMoments (the timeline hero, ≤1 breakdown)
 *   - scores      → generateSalesScores (private evidenced rubric)
 *   - cueLoop     → the closed cue→behaviour loop (rep_marked taps preferred;
 *                   otherwise post-call inference, labelled as inferred)
 *   - focus       → the ONE "Next Door Focus", derived from the review's TOP
 *                   growth area (composition — the same verdict, not a new one)
 *
 * Never throws — a summary failure returns hasSignal:false, never a fabricated
 * debrief (§3.4). The four LLM engines run concurrently to keep this close to
 * the "before the next driveway" latency intent (still not instant — see the
 * build report's L3 note).
 */

export type CueLoopEntry = {
  cueText: string;
  mode: CueMode;
  timestampLabel: string | null;
  /** null when we genuinely don't know whether the rep followed it. */
  determination: CueOutcomeDetermination | null;
  /** 'rep_marked' = rep-confirmed; 'inferred' = engine's read (§3.4). */
  source: "rep_marked" | "inferred" | null;
  evidence: string | null;
};

export type NextDoorFocus = { focus: string; why: string } | null;

export type AfterPitchSummary = {
  hasSignal: boolean;
  narrative: SalesReview;
  moments: SalesMoment[];
  scores: ScoreCategory[];
  cueLoop: CueLoopEntry[];
  focus: NextDoorFocus;
};

const EMPTY: AfterPitchSummary = {
  hasSignal: false,
  narrative: { hasSignal: false, strengths: [], growthAreas: [] },
  moments: [],
  scores: [],
  cueLoop: [],
  focus: null,
};

/**
 * Reconcile the single Next Door Focus across the score engine and the narrative
 * engine (founder-confirmed 2026-07-15: hard score wins in extremes).
 *
 * A flagged computed score is a concrete, evidenced, deterministic fix — so if
 * one is present it becomes the Focus, ahead of the LLM narrative. The scores are
 * already in rubric order (talk_ratio before question_rate), so the more
 * fundamental behaviour wins when several are flagged. A caveat category is never
 * flagged, so a capture gap can never be surfaced as the fix. Only when NO score
 * is flagged does the narrative's top growth area carry the Focus — and only then
 * can the Focus legitimately be null ("nothing stood out").
 */
export function deriveFocus(
  scores: ScoreCategory[],
  topGrowth: { opportunity: string; nextStep: string } | undefined
): NextDoorFocus {
  const flagged = scores.find((c) => c.flagged && c.focusSuggestion);
  if (flagged) {
    return { focus: flagged.focusSuggestion as string, why: flagged.rationale };
  }
  return topGrowth ? { focus: topGrowth.opportunity, why: topGrowth.nextStep } : null;
}

function mmss(deltaMs: number): string {
  const total = Math.max(0, Math.round(deltaMs / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Timeline origin from the earliest real spoken_at — matches the moments
 *  engine so cue timestamps and moment timestamps share one clock. Null when
 *  no segment carries spoken_at (then no cue timestamp is fabricated). */
function timelineOrigin(segments: TranscriptSegment[]): number | null {
  let origin: number | null = null;
  for (const s of segments) {
    if (s.spokenAt) {
      const t = Date.parse(s.spokenAt);
      if (!Number.isNaN(t)) origin = origin === null ? t : Math.min(origin, t);
    }
  }
  return origin;
}

export async function generateAfterPitchSummary(args: {
  companyId: string;
  sessionId: string;
  context?: SalesContext;
  outcome?: string | null;
  /** The rep's experience dial. Standard shortens the narrative read (spec p12).
   *  Undefined → today's (Expert-length) behaviour. */
  mode?: import("@/lib/experience/mode").ExperienceMode;
}): Promise<AfterPitchSummary> {
  try {
    const segments = await getSessionTranscriptAdmin(args.sessionId);

    // STT-CAPTURE INSTRUMENTATION (founder 2026-08-13 — "some agents have no after-pitch feedback").
    // Leading hypothesis: ElevenLabs Scribe realtime STT sometimes captures zero/few AGENT turns (mic/device/
    // network), so the saved transcript is empty or one-sided → the review engine has nothing → EMPTY feedback.
    // This is the "STT captures zero turns" reliability failure that persistRecording.ts already documents, and
    // the reliability driver behind the voice migration. Logging only (no behavior change): quantify the empty /
    // one-sided rate and identify affected sessions (→ agent via a join) BEFORE any STT swap, so we can prove a
    // replacement actually improved it. `oneSided` = the customer was captured but the AGENT wasn't — the exact
    // shape that yields no "Your read" while scores/moments may still render.
    const agentTurns = segments.filter((s) => s.speaker === "agent").length;
    const customerTurns = segments.filter((s) => s.speaker === "customer").length;
    const unknownTurns = segments.filter((s) => s.speaker === "unknown").length;
    // eslint-disable-next-line no-console
    console.log(
      `[stt-capture] session=${args.sessionId} company=${args.companyId} context=${args.context ?? "?"} ` +
        `segments=${segments.length} agentTurns=${agentTurns} customerTurns=${customerTurns} ` +
        `unknownTurns=${unknownTurns} empty=${segments.length === 0} ` +
        // oneSided = 0 agent turns despite segments. cause=undecided (unknown present → attribution FIXABLE) vs
        // customerLabeled (all customer → mis-attribution or true one-sided) vs empty.
        `oneSided=${segments.length > 0 && agentTurns === 0} ` +
        `cause=${segments.length === 0 ? "empty" : agentTurns > 0 ? "ok" : unknownTurns > 0 ? "undecided" : "customerLabeled"}`
    );

    if (segments.length === 0) return EMPTY;

    // The four engines are independent — run them concurrently.
    const [narrative, momentsRes, scoresRes, cueLoop] = await Promise.all([
      generateSalesReview({
        companyId: args.companyId,
        context: args.context,
        segments,
        mode: args.mode,
      }),
      generateSalesMoments({
        companyId: args.companyId,
        context: args.context,
        outcome: args.outcome,
        segments,
      }),
      generateSalesScores({
        companyId: args.companyId,
        context: args.context,
        segments,
      }),
      buildCueLoop({
        companyId: args.companyId,
        sessionId: args.sessionId,
        segments,
      }),
    ]);

    const moments = momentsRes.moments;
    const scores = scoresRes.categories;

    // §3.2 understanding gate — the summary needs SOMETHING real to show. If
    // every engine came back empty, there isn't enough to honestly debrief.
    const hasSignal =
      narrative.hasSignal ||
      moments.length > 0 ||
      scores.length > 0 ||
      cueLoop.length > 0;
    if (!hasSignal) return EMPTY;

    // The ONE Next Door Focus. Reconciled across TWO engines, not one.
    //
    // The bug this replaces (founder-caught 2026-07-15): the Focus was
    // `narrative.growthAreas[0]` ALONE. On a thin transcript the LLM review
    // returns no growth areas, so the Focus went null and the card printed
    // "keep doing what worked" — while the COMPUTED talk-ratio was sitting at
    // 100/0 with "leave more room to listen". Two panels, two engines, no
    // cross-check: the summary contradicted its own hard data (§3.4/§3.5).
    //
    // Reconciliation rule (founder-confirmed): a HARD SCORE WINS IN EXTREMES. A
    // flagged computed score (talk-ratio ≥75, question-rate ≤15) is deterministic
    // and undeniable, so it takes the Focus; the LLM narrative is the default
    // otherwise. A caveat category (customer side not captured) is never flagged,
    // so a data gap can never become the fix. The invariant: the Focus is never
    // null while any computed score is flagged — "keep doing what worked" and a
    // flagged red number can no longer appear on the same screen.
    const focus: NextDoorFocus = deriveFocus(scores, narrative.growthAreas[0]);

    return { hasSignal: true, narrative, moments, scores, cueLoop, focus };
  } catch {
    return EMPTY;
  }
}

/**
 * Build the closed cue loop: for each delivered cue, its determination.
 * A rep_marked tap (first-party) is preferred and never overwritten. Cues
 * with NO recorded outcome get ONE post-call inference pass (source='inferred',
 * persisted append-only). Cues that already have any outcome are reused (bounds
 * re-generation cost + row growth).
 */
async function buildCueLoop(args: {
  companyId: string;
  sessionId: string;
  segments: TranscriptSegment[];
}): Promise<CueLoopEntry[]> {
  const [cues, existing] = await Promise.all([
    getSessionCuesAdmin(args.sessionId),
    getSessionCueOutcomesAdmin(args.sessionId),
  ]);
  if (cues.length === 0) return [];

  const byCue = new Map<string, CueOutcome>();
  for (const o of existing) byCue.set(o.cueId, o);

  // Cues with no recorded outcome → infer once, then persist.
  const toInfer = cues.filter((c) => !byCue.has(c.id));
  if (toInfer.length > 0) {
    const inferred = await inferCueOutcomes({
      companyId: args.companyId,
      cues: toInfer,
      segments: args.segments,
    }).catch(() => []);
    for (const inf of inferred) {
      const cue = toInfer[inf.index];
      if (!cue) continue;
      const saved = await appendCueOutcome({
        cueId: cue.id,
        sessionId: args.sessionId,
        determination: inf.determination,
        source: "inferred",
        evidence: inf.evidence,
      });
      if (saved) byCue.set(cue.id, saved);
    }
  }

  const origin = timelineOrigin(args.segments);
  return cues.map((c) => {
    const o = byCue.get(c.id) ?? null;
    let timestampLabel: string | null = null;
    if (origin !== null) {
      const t = Date.parse(c.deliveredAt);
      if (!Number.isNaN(t)) timestampLabel = mmss(t - origin);
    }
    return {
      cueText: c.text,
      mode: c.mode,
      timestampLabel,
      determination: o?.determination ?? null,
      source: o?.source ?? null,
      evidence: o?.evidence ?? null,
    };
  });
}

type InferredOutcome = {
  index: number;
  determination: CueOutcomeDetermination;
  evidence: string | null;
};

/** One LLM pass classifying whether the rep followed each cue, from what they
 *  said AFTER it. Honest by construction — this is an INFERENCE (source stays
 *  'inferred'); it is never presented as rep-confirmed (§3.4). */
async function inferCueOutcomes(args: {
  companyId: string;
  cues: Cue[];
  segments: TranscriptSegment[];
}): Promise<InferredOutcome[]> {
  const transcript = args.segments
    .map((s) => `${s.speaker === "agent" ? "REP" : s.speaker === "customer" ? "CUSTOMER" : "UNKNOWN"}: ${s.text}`)
    .join("\n");
  const cueList = args.cues
    .map((c, i) => `[${i}] (${c.mode}) "${c.text}"`)
    .join("\n");

  const systemPrompt = `You judge, for each COACH CUE delivered to a sales rep
during a live conversation, whether the rep then FOLLOWED it — based only on
what the rep actually said AFTER the cue in the transcript.

For each cue return:
- determination: "followed" (the rep clearly acted on it), "partial" (moved
  toward it but not fully), or "ignored" (no sign of it in what they said).
- evidence: a SHORT quote or paraphrase from the transcript that shows this,
  or null if there's nothing to point to.

HONESTY (§3.4): this is an inference from text, not a certainty. When there is
no clear signal either way, use "ignored" with evidence null rather than
guessing "followed". Do NOT invent evidence.

OUTPUT — ONLY this JSON:
{ "outcomes": [ { "index": 0, "determination": "followed"|"partial"|"ignored", "evidence": "..."|null } ] }` + CONVERSATION_IS_DATA;

  const userMessage = `CUES DELIVERED (index in brackets):
${cueList}

TRANSCRIPT (diarized):
${transcript}

Judge each cue by its index. JSON only.`;

  const r = await dissectCoachV5({
    companyId: args.companyId,
    systemPrompt,
    userMessage,
  });
  if (r.suppressed) return [];

  let raw: unknown;
  try {
    raw = JSON.parse(r.text);
  } catch {
    return [];
  }
  if (typeof raw !== "object" || raw === null) return [];
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.outcomes)) return [];
  const valid: CueOutcomeDetermination[] = ["followed", "partial", "ignored"];
  const out: InferredOutcome[] = [];
  for (const item of o.outcomes) {
    if (!item || typeof item !== "object") continue;
    const e = item as Record<string, unknown>;
    const index = typeof e.index === "number" ? e.index : NaN;
    if (Number.isNaN(index) || index < 0 || index >= args.cues.length) continue;
    const determination = valid.includes(e.determination as CueOutcomeDetermination)
      ? (e.determination as CueOutcomeDetermination)
      : "ignored";
    const evidence =
      typeof e.evidence === "string" && e.evidence.trim()
        ? e.evidence.trim()
        : null;
    out.push({ index, determination, evidence });
  }
  return out;
}
