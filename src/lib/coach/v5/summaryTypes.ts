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
};

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

export type ScoreKey = "opener" | "objection" | "talk_ratio" | "tone" | "close";

export type ScoreCategory = {
  key: ScoreKey;
  label: string;
  score: number;
  display: string;
  rationale: string;
  citation: string | null;
  computed: boolean;
};
