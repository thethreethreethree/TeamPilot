/**
 * CoachingStrategy — the pluggable "brain" seam for the live coaching engine.
 *
 * ┌─ STATUS: PROPOSED SEAM · NOT YET WIRED ─────────────────────────────────────────────┐
 * │ This is the Phase-2 step-1 deliverable of docs/MeetingCoach-BuildPlan.md, written at  │
 * │ the Phase-1 checkpoint for founder review. It is TYPES-ONLY and imported by NOTHING,  │
 * │ so the live Sales Coach is untouched and no regression is possible. The behavior-      │
 * │ touching steps (refactor the existing sales cue logic to IMPLEMENT this interface, then│
 * │ have the engine call strategy.analyze() instead of generateLiveCue directly) are held  │
 * │ until the reuse map (docs/SALESCOACH-REUSE-MAP.md) is confirmed. Do not wire this in    │
 * │ until then. See the reuse map's "THE SEAM" section for the three coupling layers.       │
 * └─────────────────────────────────────────────────────────────────────────────────────┘
 *
 * WHY this shape: the existing sales engine already has a natural seam function —
 * `generateLiveCue(args)` (src/lib/coach/v5/liveCue.ts:119): it takes a rolling transcript
 * window + context/hints and returns a single cue decision `{shouldCue, cue, phase, trigger,
 * importance}`. This interface GENERALIZES that exact signature so Sales, Meeting, and Huddle
 * strategies are interchangeable behind one contract — same engine (audio / STT / upload /
 * reconnect / persist / TTS-to-earpiece), different judgment. The reuse discipline of the whole
 * build: reuse the engine, swap the strategy here.
 *
 * WHAT is generalized away from the sales version (and why it must be):
 *  - `phase` / `trigger` were sales enums (opener|discovery|pitch|objection|close; objection|
 *    buying_signal|…). They become strategy-defined STRINGS: a meeting's vocabulary is
 *    drift|undecided|unassigned_action|vague_status|blocker|overrun, a huddle's is tighter. Each
 *    strategy owns its own vocabulary; the engine only needs the string to record + display it.
 *  - `speaker` was the two-party sales enum ('agent'|'customer'|'unknown'). It becomes a string
 *    because a MEETING is N-party (see reuse-map Flag 2: multi-party attribution is newly written,
 *    not reused). 'agent'/'customer' remain valid values for the sales strategy.
 *  - typed sales hints (`stress {fillerSpike,paceSpike}`, `confidence`) move into an open
 *    `signals` bag so the interface doesn't grow a sales-shaped field per hint. Each strategy
 *    validates the signals it cares about and ignores the rest (§5: a bad/absent signal → the
 *    strategy stays silent, never guesses).
 */

/** A transcript segment as a strategy sees it. `speaker` is a string, not a 2-party enum (N-party meetings). */
export interface StrategyTranscriptSegment {
  /** 'agent'|'customer' for sales; a participant id/name for a meeting. 'unknown' when unattributed. */
  speaker: string;
  text: string;
  /** Monotonic order within the session. */
  seq: number;
  /** Wall-clock the words were spoken, when the feed provides it. */
  spokenAt?: string | null;
}

/** How forceful a delivered cue should be. Generalized from the sales 'suggestion'|'guide_response'. */
export type CueMode = "suggestion" | "directive";

/** Importance of a cue — drives the delivery gate's decision to speak now, defer, or drop. */
export type CueImportance = "low" | "medium" | "high";

/** Everything a strategy needs at analyze() time, beyond the transcript window itself. */
export interface CoachingContext {
  /** The session kind that frames the strategy: 'in_person'|'video' today; 'meeting'|'huddle' after the mode migration. */
  sessionKind: string;
  /**
   * The company the session belongs to. REQUIRED — a strategy grounds its cues in company-scoped material
   * (methodology, product, corpus, winning lines); the sales `generateLiveCue` cannot run without it. (Design
   * gap found while implementing SalesStrategy against the real engine — the first interface draft omitted this.)
   */
  companyId: string;
  /**
   * The person wearing the earpiece / receiving cues — the sales rep, or the meeting facilitator. Optional:
   * absent → generic + company grounding only. Generalized from the sales `agentId`.
   */
  wearerId?: string;
  /** Requested cue forcefulness. */
  mode: CueMode;
  /** The wearer explicitly asked ("coach me now") — bypass the silence/understanding gate and return a concrete cue. */
  force?: boolean;
  /** A client silence timer fired (a long quiet). The strategy still decides — some silences are sacred. */
  stall?: boolean;
  /**
   * Strategy-specific hints (sales: `{ stress: {fillerSpike,paceSpike}, confidence }`; a meeting strategy
   * defines its own). Kept open so the shared contract doesn't carry one domain's hint shapes. A strategy
   * reads only the keys it understands and treats missing/malformed signals as "no hint" (stay silent, §3.2).
   */
  signals?: Record<string, unknown>;
}

/**
 * A strategy's verdict for one analysis pass. Generalized from the sales `LiveCueResult`.
 *
 * Single decision, not an array: the engine delivers ONE cue at a time to the wearer's earpiece
 * (over-cueing is noise — the delivery gate + the "a late tip is worthless" latency discipline both
 * assume one cue). A strategy that detects several issues returns its single most important one now; the
 * next pass surfaces the next. This is a deliberate deviation from the plan's `→ Cue[]`, matching the real
 * engine and the don't-overwhelm-the-earpiece rule (§3.3). Revisit if a batched-cue UI is ever built.
 */
export interface CueDecision {
  /** Whether to deliver a cue at all. `false` is the common, correct case (§3.2: silent under low confidence). */
  shouldCue: boolean;
  /** The cue text to speak/show, or null when shouldCue is false. */
  cue: string | null;
  /** Strategy-defined trigger vocabulary (sales: 'objection'; meeting: 'drift'|'unassigned_action'|…). '' when silent. */
  trigger: string;
  /** Optional strategy-defined phase/situation label, for the record + dissect. */
  phase?: string;
  /** Delivery priority; drives the (context-agnostic, already-reusable) cueDelivery gate. */
  importance?: CueImportance;
}

/**
 * The pluggable coaching brain. Every mode (sales / meeting / huddle) implements this; the engine calls
 * `analyze()` and knows nothing about the domain. On an AUTO cue (`context.force` falsy) it MUST NOT throw — a
 * cue failure can never disrupt a live call; it resolves to a stay-silent decision. On a FORCED cue
 * (`context.force` true — the wearer explicitly asked) it MAY throw on a provider failure, so the route surfaces
 * the error honestly instead of a false "nothing to add" (error-dressed-as-no-data). The caller (route) must
 * catch a forced-cue throw and return an honest error. Mirrors the sales `generateLiveCue` force-re-throw.
 */
export interface CoachingStrategy {
  /** Stable identifier for the record/dissect + mode selection. e.g. 'sales' | 'meeting' | 'huddle'. */
  readonly kind: string;
  /**
   * Read the recent transcript window + context and decide whether to deliver a cue.
   * @param segments the rolling transcript window (most-recent-last).
   * @param context  session kind, requested mode, and strategy-specific hint signals.
   */
  analyze(segments: StrategyTranscriptSegment[], context: CoachingContext): Promise<CueDecision>;
}

/**
 * The single LLM call a strategy's brain needs, DEPENDENCY-INJECTED so the strategy class carries no binding,
 * model, or gating decision (those are the wearer/product's call, resolved at wire time). Its result shape
 * mirrors the sales `liveSalesCue` binding: `text` is the raw model JSON to parse; `suppressed` is true when a
 * gate (e.g. the §3.4 control window) declined to run the model — the strategy then stays silent WITHOUT
 * parsing (A40: consume the gate's verdict, don't re-derive it). Injecting this keeps the meeting/huddle
 * strategies pure + testable and defers the control-gate/model choice to whatever function is supplied.
 */
export interface CueLLM {
  (args: { systemPrompt: string; userMessage: string }): Promise<{ text: string; suppressed?: boolean }>;
}
