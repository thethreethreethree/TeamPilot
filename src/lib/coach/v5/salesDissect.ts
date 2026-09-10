import "server-only";
// Prompt-injection fence — the transcript carries untrusted CUSTOMER speech.
import { CONVERSATION_IS_DATA } from "@/lib/care/toolPrompts";
import { dissectCoachV5 } from "@/lib/claude";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getCurrentSalesCorpus,
  type TranscriptSegment,
  type SalesContext,
} from "@/lib/data/salesCoach";
import { buildSalesDissectSystemPrompt } from "./salesDissectPrompt";
import { buildSalesReviewUserMessage } from "./salesReviewPrompt";

/**
 * Live Sales Coach — "Dissect" engine: a deep, full-conversation teaching
 * evaluation. Composes on the same path as the growth review (§A21 —
 * debrief brain + the editable methodology corpus), with a richer output:
 * strengths (with why), growth (with why + next step), the standout
 * strategy the agent used, and an overall teaching note.
 *
 * Never throws; on sparse input / failure / month-1 suppression it returns
 * the honest empty state (§3.4) — no fabricated evaluation.
 */

export type DissectStrength = { point: string; example: string; why: string };
export type DissectGrowth = {
  opportunity: string;
  nextStep: string;
  why: string;
};
export type DissectStrategy = { name: string; example: string; why: string };

export type SalesDissect = {
  hasSignal: boolean;
  strengths: DissectStrength[];
  growthAreas: DissectGrowth[];
  standoutStrategy: DissectStrategy | null;
  overall?: string;
  /** Which empty this is (see DissectEmptyShape). Absent when hasSignal. */
  emptyShape?: DissectEmptyShape;
};

/**
 * WHICH empty a dissect is. `reason` on the stored marker stays "no_signal" / "no_agent_turns" because the
 * sessions-list UI reads that vocabulary; this sits BESIDE it and says which of the shapes actually happened.
 *
 * Every one of these already existed here as a separate `console.error` with its own sentence, and every one
 * was thrown away at the `return EMPTY` boundary — so the durable record collapsed them into one word while
 * the distinction lived only in a serverless log nobody reads. That is why half of all coaching runs
 * producing nothing has stayed undiagnosable: 92 of 100 declines say "no_signal" and cannot say which.
 *
 *   no_agent_turns — 0 agent turns; short-circuited BEFORE the LLM. Not a model failure at all.
 *   suppressed     — the control window declined the call. Not a failure either.
 *   llm_empty      — the model returned NO text. This is the starvation shape: the 2026-07-30 outage, a
 *                    reasoning model spending its whole budget before writing any content. A longer
 *                    transcript makes it WORSE, and more wall-clock time does not help it at all.
 *   unparsable     — text came back and was not valid dissect JSON.
 *   no_strengths   — valid JSON, but no strengths, so the tone law refuses it (never criticism-only). This
 *                    is the only shape that means what "no signal" sounds like it means.
 *   threw          — an exception on the path.
 */
export type DissectEmptyShape =
  | "no_agent_turns"
  | "suppressed"
  | "llm_empty"
  | "unparsable"
  | "no_strengths"
  | "threw";

const EMPTY: SalesDissect = {
  hasSignal: false,
  strengths: [],
  growthAreas: [],
  standoutStrategy: null,
};

/** The honest empty state, carrying which empty it is. */
function emptyBecause(shape: DissectEmptyShape): SalesDissect {
  return { ...EMPTY, emptyShape: shape };
}

// Founder 2026-08-05: NO minimum-length gate — every session gets a dissect, however
// short. Only a genuinely empty rep side (0 agent turns) is excluded (§3.4).
const MIN_AGENT_SEGMENTS = 1;

export async function generateSalesDissect(args: {
  companyId: string;
  sessionTitle?: string;
  context?: SalesContext;
  segments: TranscriptSegment[];
}): Promise<SalesDissect> {
  try {
    const agentSegments = args.segments.filter((s) => s.speaker === "agent");
    if (agentSegments.length < MIN_AGENT_SEGMENTS) return emptyBecause("no_agent_turns");

    const [corpus, product] = await Promise.all([
      getCurrentSalesCorpus(args.companyId).catch(() => null),
      getCurrentSalesCorpus(args.companyId, "product").catch(() => null),
    ]);
    const systemPrompt =
      buildSalesDissectSystemPrompt(corpus?.content, product?.content) +
      CONVERSATION_IS_DATA;
    const userMessage = buildSalesReviewUserMessage({
      sessionTitle: args.sessionTitle,
      context: args.context,
      segments: args.segments,
    });

    const r = await dissectCoachV5({
      companyId: args.companyId,
      systemPrompt,
      userMessage,
    });
    if (r.suppressed) return emptyBecause("suppressed");

    // Do NOT swallow an EMPTY LLM response as "honest empty state" — that is the error-dressed-as-no-data
    // failure (INV22). The 2026-07-30 outage was exactly this: deepseek-v4-flash (a reasoning model) burned
    // the whole token budget on reasoning and returned empty content, which parseDissect turned into EMPTY
    // and the bare catch hid — "Your read" went blank for 2 weeks with no signal in the logs. Distinguish the
    // three outcomes LOUDLY so a regression surfaces immediately.
    if (!r.text || !r.text.trim()) {
      // eslint-disable-next-line no-console
      console.error(
        `[generateSalesDissect] LLM returned EMPTY text (model=${r.model}, provider=${r.provider}) — likely token-budget starvation on a reasoning model. Dissect will be blank.`
      );
      return emptyBecause("llm_empty");
    }
    const parsed = parseDissect(r.text);
    if (!parsed || !parsed.hasSignal) {
      // eslint-disable-next-line no-console
      console.error(
        `[generateSalesDissect] parseDissect produced no signal (textLen=${r.text.length}, model=${r.model}) — JSON parse failure or no strengths extracted.`
      );
      // parseDissect returns null on malformed JSON and the empty state when the tone law refuses a
      // strengths-less read. Those are different problems with different fixes, so they are recorded apart.
      return emptyBecause(parsed ? "no_strengths" : "unparsable");
    }
    return parsed;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(
      `[generateSalesDissect] threw: ${e instanceof Error ? e.message : String(e)}`
    );
    return emptyBecause("threw");
  }
}

/**
 * Generate the dissect AND store it as an event (§3.1) when it has signal.
 * One mechanism used by both the on-demand dissect route and the
 * server-side finalize. Best-effort on the event store. Empty/thin sessions
 * return the honest empty state and store nothing (§3.4 — no fabrication).
 */
export async function runAndStoreDissect(args: {
  companyId: string;
  actorId: string;
  sessionId: string;
  segments: TranscriptSegment[];
  sessionTitle?: string;
  context?: SalesContext;
}): Promise<SalesDissect> {
  const dissect = await generateSalesDissect({
    companyId: args.companyId,
    sessionTitle: args.sessionTitle,
    context: args.context,
    segments: args.segments,
  });
  if (dissect.hasSignal) {
    try {
      const admin = createAdminClient();
      await admin.from("events").insert({
        company_id: args.companyId,
        actor: args.actorId,
        kind: "coach.dissect_generated",
        subject: `sales_session:${args.sessionId}`,
        payload: {
          strengths: dissect.strengths,
          growth_areas: dissect.growthAreas,
          standout_strategy: dissect.standoutStrategy,
          overall: dissect.overall ?? null,
          coach_version: "dissect-v1",
        },
      });
    } catch {
      /* best-effort — the dissect still returns */
    }
  } else {
    // No signal → emit an ATTEMPTED marker so the backfill (dissectBackfill.ts, which reads this by KIND) BACKS
    // OFF (14d) instead of re-selecting this stuck session every cron pass / button click forever — the
    // dissect-cron cost loop (2026-08-14). There are TWO no-signal shapes; `reason` distinguishes them for the
    // sessions-list UI (list/route.ts reads it), while the backoff is identical for both:
    //   - "no_signal": agent turns present, the LLM RAN (past generateSalesDissect's MIN gate; dissect is
    //     controlExempt, never suppressed) but produced nothing — starved (F3 corpus), tone-law-rejected (growth
    //     but no strengths), or empty-with-turns. Recoverable by a corpus-trim after the window.
    //   - "no_agent_turns": 0 agent turns, so generateSalesDissect short-circuited BEFORE the LLM (line 60) — the
    //     rep's side wasn't captured/attributed. The After-Pitch composite can still render via customer-side
    //     moments, so this session reads "analyzed but not dissected" (the 9/2 partner-meeting bug). Recoverable
    //     only by re-transcription / speaker re-label (which regenerates directly, bypassing this backoff).
    // The 2026-08-14 fix guarded this marker on `agent turns >= MIN` and left the 0-agent case emitting NOTHING,
    // so it stayed "missing" with no backoff and looped in the backfill forever (fixed 2026-09-09). Best-effort —
    // a missed emit just re-checks next pass.
    const agentTurns = args.segments.filter((s) => s.speaker === "agent").length;
    const reason = agentTurns >= MIN_AGENT_SEGMENTS ? "no_signal" : "no_agent_turns";
    /*
     * HOW BIG WAS THE CALL THAT PRODUCED NOTHING. `reason` stays exactly as it is - the
     * sessions-list UI reads that vocabulary - and this is added beside it, because the size
     * is what turns a count into a diagnosis.
     *
     * Measured on production 10 September 2026: of 168 sessions the engines can read, 56 ran
     * the LLM and produced nothing, and they are systematically the LONGER calls - median 683
     * words against 362 for the ones that succeeded. Thin content would be SHORT, so "no
     * signal" is the wrong story for most of these.
     *
     * The two candidate causes leave the same trace and need different fixes. A wall-clock
     * TIMEOUT is fixed by raising the bound; TOKEN STARVATION - which this file's own header
     * records costing two weeks of blank reads in the 2026-07-30 outage, a reasoning model
     * spending its whole budget before writing any content - is made WORSE by a longer
     * transcript and is not fixed by more time at all.
     *
     * Recording the size makes that separable from a database query instead of from a
     * serverless log nobody reads, which is why the distinction has been invisible.
     */
    const transcriptWords = args.segments.reduce(
      (n, seg) => n + String(seg.text ?? "").split(/\s+/).filter(Boolean).length,
      0
    );
    try {
      const admin = createAdminClient();
      await admin.from("events").insert({
        company_id: args.companyId,
        actor: args.actorId,
        kind: "coach.dissect_attempted",
        subject: `sales_session:${args.sessionId}`,
        payload: {
          reason,
          // WHICH no-signal this is. `reason` keeps its two-word vocabulary for the sessions list; `shape`
          // is what makes "half of all coaching produces nothing" answerable from a query instead of a guess
          // — llm_empty means starvation (more time will not help), no_strengths means the call really had
          // nothing to praise.
          shape: dissect.emptyShape ?? null,
          agentTurns,
          transcriptWords,
          coach_version: "dissect-v1",
        },
      });
    } catch {
      /* best-effort — the backoff just doesn't apply this run */
    }
  }
  return dissect;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

// Exported for test: parseDissect enforces the same structural TONE LAW as the
// review (no strengths → no signal, never criticism-only), requires a growth
// area to carry BOTH an opportunity and a nextStep (no dangling critique), and
// degrades honestly on malformed output. Constitutional invariants worth pinning.
export function parseDissect(text: string): SalesDissect | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;

  const strengths: DissectStrength[] = (
    Array.isArray(o.strengths) ? o.strengths : []
  )
    .map((it) => {
      const x = (it ?? {}) as Record<string, unknown>;
      return { point: str(x.point), example: str(x.example), why: str(x.why) };
    })
    .filter((s) => s.point)
    .slice(0, 4);

  const growthAreas: DissectGrowth[] = (
    Array.isArray(o.growthAreas) ? o.growthAreas : []
  )
    .map((it) => {
      const x = (it ?? {}) as Record<string, unknown>;
      return {
        opportunity: str(x.opportunity),
        nextStep: str(x.nextStep),
        why: str(x.why),
      };
    })
    .filter((g) => g.opportunity && g.nextStep)
    .slice(0, 4);

  let standoutStrategy: DissectStrategy | null = null;
  if (o.standoutStrategy && typeof o.standoutStrategy === "object") {
    const x = o.standoutStrategy as Record<string, unknown>;
    const name = str(x.name);
    if (name) {
      standoutStrategy = {
        name,
        example: str(x.example),
        why: str(x.why),
      };
    }
  }

  const overall = str(o.overall) || undefined;

  // Tone law is structural: an evaluation with no strengths is invalid
  // (never lead with — or consist only of — criticism). Treat it as no
  // signal rather than shipping a tone-law violation.
  const hasSignal = o.hasSignal === false ? false : strengths.length > 0;
  if (!hasSignal) return EMPTY;

  return { hasSignal: true, strengths, growthAreas, standoutStrategy, overall };
}
