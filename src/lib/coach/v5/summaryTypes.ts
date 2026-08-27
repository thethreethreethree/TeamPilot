/**
 * Shared, CLIENT-SAFE shapes for the Sales-Coach summary surfaces.
 *
 * WHY (audit finding 3, §A13 — author the space once): the pivot / moment /
 * score shapes cross the server→client boundary. The server engines
 * (salesPivot.ts, salesMoments.ts, salesScore.ts) are `server-only`, so a client
 * component cannot import them. Before this module those shapes were re-declared
 * inside the client component, so a server field change would silently drift the
 * client renderer. This module is the SINGLE definition: the server engines
 * import + re-export from here, and the client component imports from here — one
 * shape, consumed by reference. Pure types, no runtime, no `server-only`, so it
 * is safe on both sides.
 */

export type MomentKind =
  | "opener"
  | "discovery"
  | "objection"
  | "breakdown"
  | "close"
  | "other";

export type MomentCorrection = { correctLine: string; whyItWorks: string };

/** Customer-sentiment direction AT this moment — the continuous read across the
 *  timeline (founder 2026-07-07), distinct from the single decisive Pivot. */
export type MomentSentiment = "warming" | "cooling" | "neutral";

export type SalesMoment = {
  atSeq: number;
  /** "1:04" when spoken_at is known for this segment, else null (§3.4). */
  timestampLabel: string | null;
  kind: MomentKind;
  label: string;
  customerLine: string | null;
  repLine: string | null;
  note: string | null;
  isBreakdown: boolean;
  /** Present only on the breakdown moment. */
  correction: MomentCorrection | null;
  /** The customer's sentiment direction at this moment. Optional for backward
   *  compatibility with moments stored before this field existed. */
  sentiment?: MomentSentiment;
};

/**
 * Whole-call objection tally (founder 2026-08-28) — how many distinct objections the CUSTOMER raised across the
 * call, and how many the rep RESOLVED (the customer moved past it). A COUNT over the full transcript, distinct
 * from the 3-5 hero `moments` (which surface an objection only when it was a defining moment, so they undercount).
 * Feeds the Layer-2 "Objections per session" + "Objections resolved" KPIs. Absent on summaries generated before
 * this field existed → the KPI EXCLUDES that session (honest "building", never a fabricated 0), so it lights up as
 * sessions are (re)analyzed.
 */
export type ObjectionTally = { raised: number; resolved: number };

export type PivotDirection = "gained" | "lost";

export type PivotMoment = {
  atSeq: number;
  timestampLabel: string | null;
  direction: PivotDirection;
  label: string;
  customerLine: string | null;
  repLine: string | null;
  whatHappened: string;
  whyItMattered: string;
};

export type ScoreKey =
  | "opener"
  | "objection"
  | "talk_ratio"
  | "question_rate"
  | "tone"
  | "close"
  | "next_step";

export type ScoreCategory = {
  key: ScoreKey;
  label: string;
  score: number;
  display: string;
  rationale: string;
  citation: string | null;
  computed: boolean;
  /**
   * A computed observation sitting in a GROWTH band (e.g. talk-ratio ≥75%,
   * question-rate ≤15%). It is a concrete, evidenced fix — so the After-Pitch
   * assembler may promote it to the single Next Door Focus. Added 2026-07-15
   * (founder-confirmed) to stop the Focus contradicting a flagged score: the
   * summary must never say "keep doing what worked" while this is true.
   * Optional — absent means "not a flagged growth signal".
   */
  flagged?: boolean;
  /**
   * The imperative one-liner to carry into the next door when THIS category
   * becomes the Focus (e.g. "Leave more room to listen"). Present only when
   * `flagged` is true. The rationale supplies the "why".
   */
  focusSuggestion?: string;
  /**
   * This is a DATA-CAPTURE CAVEAT, not a measurement — e.g. the customer side
   * of the call was never transcribed, so a 100/0 talk ratio would report a gap
   * as if it were behaviour (§3.4). When true, the surface renders it as a muted
   * note, never a score, and it is never `flagged`. Added 2026-07-15.
   */
  caveat?: boolean;
};

/**
 * Conversation-intelligence extraction (founder 2026-07-07): competitors named
 * in the call + the topics discussed. Manager-visible observations (not scores).
 */
export type SalesIntel = {
  /** Competitor / alternative-provider names actually mentioned in the call. */
  competitors: string[];
  /** 3-5 recurring topics discussed (e.g. "pricing", "contract length"). */
  topics: string[];
};
