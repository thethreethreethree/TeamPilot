import type { TranscriptSpeaker } from "@/lib/data/salesCoach";

/**
 * Live Sales Coach — speaker attribution signals, composed.
 *
 * Extracted from useLiveCoaching (AMD-006 L1 structure) so the attribution
 * logic is testable in isolation and the content vocabulary is a DESIGNED
 * CATEGORY SPACE (A13: author the space by category in a shared library, not a
 * word-per-incident patch). New tells extend a CATEGORY here; they are never
 * added ad-hoc at a call-site.
 *
 * The four live signals compose (A16 — they read each other, never contradict):
 *   1. manual "I'm speaking" toggle  — ground truth (rep-driven)
 *   2. content tell (this file)      — reliable in person, INSTANT (no network)
 *   3. pitch cluster                 — acoustic, once anchored
 *   4. loudness                      — weakest in person (prospect can be louder)
 * Content is weighted above the acoustic signals because in person the mic
 * holds both voices and loudness/pitch are unreliable; the LLM /attribute
 * refines the non-obvious turns downstream. Voice is NOT discarded — it decides
 * every turn the content can't (A16).
 */

/** One content tell: a phrase pattern that, when matched, indicates a speaker. */
type ContentTell = {
  speaker: TranscriptSpeaker; // "agent" = salesperson, "customer" = prospect
  category:
    | "seller-offer"
    | "seller-pitch"
    | "buyer-ask"
    | "buyer-price"
    | "buyer-need";
  re: RegExp;
};

// The KEY asymmetry the 2026-07-06 live test exposed: OFFERING to provide
// ("I can give you detail") is the salesperson; ASKING for it ("give me
// detail") is the prospect. The categories keep that asymmetry explicit.
const CONTENT_TELLS: readonly ContentTell[] = [
  // ── SELLER ────────────────────────────────────────────────────────────
  {
    speaker: "agent",
    category: "seller-offer",
    re: /\b(let me (show|walk|explain|tell)|i can (show|give|walk|offer)|how about i (show|walk)|i'?ll (show|give|walk) you|here'?s how (it|the|this))\b/,
  },
  {
    speaker: "agent",
    category: "seller-pitch",
    re: /\b(we (offer|provide|can do)|our (product|service|pricing|offer|plan|solution)|what (we|it) (does|do) is|the way it works)\b/,
  },
  // ── BUYER ─────────────────────────────────────────────────────────────
  {
    speaker: "customer",
    category: "buyer-ask",
    re: /\b(i (wanna|want to|'?d like to|would like to) (see|know|hear|learn|understand)|can you (give|show|tell|send) me|give me (more )?detail|show me|tell me more)\b/,
  },
  {
    speaker: "customer",
    category: "buyer-price",
    re: /\b(how much (does|is|would|will|are|for)\b|how much.{0,20}(cost|price)|what'?s the (price|cost)|is there a discount)\b/,
  },
  {
    speaker: "customer",
    category: "buyer-need",
    re: /\b(i'?m (not sure|interested|worried|concerned)|we'?re looking for|my (concern|worry|issue) is|the problem (i|we) have)\b/,
  },
];

/**
 * Instant, content-based speaker guess. Returns a speaker only when the content
 * is an UNAMBIGUOUS tell (matches one side and NOT the other); null otherwise so
 * voice + the LLM decide (null is safe — a wrong confident label is not).
 */
export function guessSpeakerFromContent(text: string): TranscriptSpeaker | null {
  const t = ` ${text.toLowerCase().replace(/[.,!?;:]/g, " ")} `;
  let seller = false;
  let buyer = false;
  for (const tell of CONTENT_TELLS) {
    if (tell.re.test(t)) {
      if (tell.speaker === "agent") seller = true;
      else buyer = true;
    }
  }
  if (seller && !buyer) return "agent";
  if (buyer && !seller) return "customer";
  return null; // ambiguous / mixed / no tell → voice + LLM decide
}

/**
 * Smart auto-release of the manual "I'm speaking" lock (founder 2026-08-21).
 *
 * The lock is STICKY — a single earbud tap holds it ON until tapped OFF — so a rep who forgets to
 * release it collapses the whole call to "agent" (every subsequent turn, INCLUDING the customer's,
 * inherits the lock; ~26% of transcribed sessions were all-"agent" from exactly this). When the lock is
 * ON but THIS turn's content is an UNAMBIGUOUS customer tell — a lock-INDEPENDENT signal that the rep's
 * turn is plainly over — the lock is almost certainly stuck. Release it so this turn and the ones after
 * it attribute normally. Only the confident buyer content tell (guessSpeakerFromContent returns
 * "customer" ONLY when unambiguous) may overturn the rep's explicit toggle; pitch/loudness are too weak
 * in person to overturn a ground-truth signal, so they never trigger a release.
 *
 * This is the SINGLE SOURCE for the release decision (§2.2/AMD-010): the hook computes it once, BEFORE
 * the pitch cluster is anchored to "agent", then feeds the resolved lock into composeProvisional — which
 * never re-derives it. Called with the toggle's raw ON state and this turn's content guess.
 */
export function shouldReleaseLock(
  locked: boolean,
  content: TranscriptSpeaker | null
): boolean {
  return locked && content === "customer";
}

export type AttributionSource =
  | "video-mic"
  | "manual"
  | "content"
  | "pitch"
  | "loudness";

/**
 * Compose the four live signals into the provisional label (A16). Priority:
 * manual toggle > content tell > trusted pitch > loudness. Returns the deciding
 * SOURCE so the UI/log can show WHY a turn was attributed (§3.6).
 */
export function composeProvisional(signals: {
  locked: boolean;
  content: TranscriptSpeaker | null;
  pitch: TranscriptSpeaker | null;
  pitchTrusted: boolean;
  loudness: TranscriptSpeaker;
  /** Video is mic-only = agent-only: the prospect is on the far end of the
   *  call, not in the mic. This is a HARD context constraint that overrides
   *  every acoustic/content signal — every captured turn is the rep. Defaults
   *  false (in-person, one mic holds both voices). */
  isVideo?: boolean;
}): { speaker: TranscriptSpeaker; source: AttributionSource } {
  if (signals.isVideo) return { speaker: "agent", source: "video-mic" };
  if (signals.locked) return { speaker: "agent", source: "manual" };
  if (signals.content) return { speaker: signals.content, source: "content" };
  if (signals.pitchTrusted && signals.pitch) {
    return { speaker: signals.pitch, source: "pitch" };
  }
  return { speaker: signals.loudness, source: "loudness" };
}
