/**
 * Live Sales Coach — the confidence READ (build 4). A TRANSPARENT aggregation
 * of the measurable signals (build 3's filler/pace spikes + talk-ratio) into a
 * coarse, legible read of how steadily the rep is holding up.
 *
 * §4 — this is SIGNAL-BASED, NOT validated against outcomes. It is deliberately
 * NOT a precise "confidence score" (a number would imply a validation we don't
 * have). A validated version — do these signals actually predict outcomes? —
 * accrues from the persisted cue signals (migration 0079) + Phase 2 outcomes,
 * a LATER build. Until then this reads the room; it does not grade it.
 *
 * §3.5 — the honest moat: don't fake the score. §3.4 — coarse + transparent
 * (the caller shows the components, not just the label). Pure + deterministic.
 */

export type ConfidenceLevel = "steady" | "wavering" | "unsteady";

export type ConfidenceRead = {
  level: ConfidenceLevel;
  fillerHigh: boolean; // filler spiked on several recent rep turns
  rushing: boolean; // pace spiked on several recent rep turns
  repTalkShare: number; // 0..1 — the rep's share of recent words
  talkShareKnown: boolean; // false when the prospect isn't audible (video mic-only)
  overTalking: boolean; // rep dominating the conversation
  hasEnough: boolean; // enough recent rep turns to read anything
  // §4 — always true here: this is a signal-based read, never a verdict.
  note: string;
};

// Tuning knobs (founder-revisable, flagged in the build report).
const MIN_REP_TURNS = 3; // warm-up before any read
const SPIKE_COUNT_HIGH = 2; // >=2 spikes in the recent window => "high"
const OVER_TALK_SHARE = 0.75; // rep speaking >=75% of words => dominating
const OVER_TALK_MIN_WORDS = 30; // ignore talk-share until there's enough speech

export function computeConfidence(args: {
  // The last N rep turns' measured stress flags (build 3), newest last.
  recentStress: { filler: boolean; pace: boolean }[];
  repWords: number;
  customerWords: number;
  // false in video (mic-only = agent-only): the prospect is on the far end and
  // not in the mic, so talk-share is unmeasurable and over-talking cannot be
  // judged. Defaults true (in-person, one mic holds both voices).
  customerAudible?: boolean;
}): ConfidenceRead {
  const customerAudible = args.customerAudible !== false;
  const repTurns = args.recentStress.length;
  const totalWords = args.repWords + args.customerWords;
  const repTalkShare = totalWords > 0 ? args.repWords / totalWords : 0;

  const empty: ConfidenceRead = {
    level: "steady",
    fillerHigh: false,
    rushing: false,
    repTalkShare,
    talkShareKnown: customerAudible,
    overTalking: false,
    hasEnough: false,
    note: "Reading the room — a few more turns before there's a signal.",
  };
  if (repTurns < MIN_REP_TURNS) return empty;

  const fillerCount = args.recentStress.filter((s) => s.filler).length;
  const paceCount = args.recentStress.filter((s) => s.pace).length;
  const fillerHigh = fillerCount >= SPIKE_COUNT_HIGH;
  const rushing = paceCount >= SPIKE_COUNT_HIGH;
  // Over-talking needs the prospect's share — meaningless when they're not
  // audible (§3.4: don't infer a signal we can't measure). Video → always false.
  const overTalking =
    customerAudible &&
    totalWords >= OVER_TALK_MIN_WORDS &&
    repTalkShare >= OVER_TALK_SHARE;

  // Coarse level — deliberately three buckets, not a number (§3.4/§4).
  let level: ConfidenceLevel = "steady";
  if (fillerHigh && rushing) level = "unsteady";
  else if (fillerHigh || rushing || overTalking) level = "wavering";

  const note =
    level === "steady"
      ? "Holding steady — signal-based, not a verdict."
      : "Some wobble in the measurable signals — signal-based, not a verdict.";

  return {
    level,
    fillerHigh,
    rushing,
    repTalkShare,
    talkShareKnown: customerAudible,
    overTalking,
    hasEnough: true,
    note,
  };
}
