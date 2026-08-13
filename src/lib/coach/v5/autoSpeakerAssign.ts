import { guessSpeakerFromContent } from "./speakerAttribution";

/**
 * Live Sales Coach — SERVER-SIDE auto speaker assignment for post-call recovery.
 *
 * The manual recovery flow re-diarizes the saved audio into speaker CLUSTERS
 * (speaker_0, speaker_1, …) and asks the rep to tap "which voice is you?". The
 * AUTOMATIC recovery has no rep to tap, so it must decide which cluster is the
 * AGENT itself — WITHOUT ever saving a confident wrong label (§3.4: a fabricated
 * attribution corrupts the exact record the review + scores run on, which is the
 * whole failure we're recovering from). When it can't decide confidently it
 * DECLINES (`decided:false`) and the caller falls back to the one-tap card — the
 * same doctrine guessSpeakerFromContent encodes: "null is safe, a wrong confident
 * label is not".
 *
 * Two composed signals, strongest first (A16 — they read each other):
 *   1. CROSS-MATCH to the turns the live path already captured as the agent. When
 *      the capture gap dropped the CUSTOMER side (the common case — agent turns are
 *      present, customer missing), the live transcript's agent turns are ground
 *      truth: the re-diarized cluster whose words overlap them most IS the agent.
 *      Overlap coefficient (|A∩C| / min(|A|,|C|)) so a long cluster isn't penalized;
 *      robust to the small wording differences between the live and batch transcription
 *      of the same audio.
 *   2. CONTENT TELLS (guessSpeakerFromContent) — the cluster with the strongest net
 *      SELLER signal is the agent. Independent of the (possibly wrong) live labels,
 *      so it's the fallback when there are no known agent turns to cross-match.
 *
 * There is deliberately NO first-speaker auto-save: a "the rep usually opens" guess
 * is too weak to stake the canonical transcript on. Better to decline and let the rep
 * tap once than to write a confident wrong label.
 */

export type DiarizedSegment = { speakerId: string; text: string; seq: number };

export type AutoAssignResult =
  | {
      decided: true;
      agentSpeakerId: string;
      confidence: number;
      source: "cross-match" | "content-tell";
    }
  | {
      decided: false;
      reason: "single-cluster" | "ambiguous" | "no-signal";
      clusterIds: string[];
    };

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "be", "to",
  "of", "in", "on", "for", "it", "that", "this", "i", "you", "we", "they", "so",
  "with", "at", "as", "if", "do", "does", "did", "have", "has", "had", "not",
  "my", "your", "our", "me", "us", "just", "like", "yeah", "okay", "ok", "um",
  "uh", "well", "right", "gonna", "know",
]);

/** Content tokens (lowercased, punctuation-stripped, stopwords + very short words
 *  dropped) — the distinctive words that make an overlap comparison meaningful. */
function contentTokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().replace(/[^a-z0-9\s']/g, " ").split(/\s+/)) {
    const w = raw.replace(/^'+|'+$/g, "");
    if (w.length < 3 || STOPWORDS.has(w)) continue;
    out.add(w);
  }
  return out;
}

/** Overlap coefficient: |A∩B| / min(|A|,|B|). 0 when either side is empty. Chosen
 *  over Jaccard so a long cluster (many tokens) isn't penalized for its length. */
function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter += 1;
  return inter / Math.min(a.size, b.size);
}

type Cluster = { speakerId: string; firstSeq: number; tokens: Set<string>; textLen: number };

function clustersOf(diarized: DiarizedSegment[]): Cluster[] {
  const byId = new Map<string, { firstSeq: number; text: string }>();
  for (const s of diarized) {
    const c = byId.get(s.speakerId);
    if (c) {
      c.text += " " + s.text;
      if (s.seq < c.firstSeq) c.firstSeq = s.seq;
    } else {
      byId.set(s.speakerId, { firstSeq: s.seq, text: s.text });
    }
  }
  return Array.from(byId.entries()).map(([speakerId, v]) => ({
    speakerId,
    firstSeq: v.firstSeq,
    tokens: contentTokens(v.text),
    textLen: v.text.trim().length,
  }));
}

// Decision thresholds — tuned so an ambiguous or coin-flip case DECLINES rather than
// stakes the record on a guess.
const CROSS_MIN_SIM = 0.3; // the winning cluster must genuinely overlap the known agent turns
const CROSS_MIN_MARGIN = 0.15; // …and beat the runner-up by a clear separation
const TELL_MIN_GAP = 2; // net seller-signal gap between the winner and the rest
const KNOWN_MIN_TURNS = 2; // need ≥2 known agent turns before trusting cross-match
const KNOWN_MIN_TOKENS = 12; // …with enough distinctive tokens to compare against

export function autoAssignAgentCluster(args: {
  diarized: DiarizedSegment[];
  /** Text of the EXISTING 'agent'-labeled turns from the live transcript. In the
   *  customer-missing case this is populated and reliable ground truth. */
  knownAgentTurns: string[];
}): AutoAssignResult {
  const clusters = clustersOf(args.diarized);
  const clusterIds = clusters.map((c) => c.speakerId);

  // <2 distinct voices → the audio itself is one-sided; nothing to recover. The honest
  // terminal (the caller surfaces "couldn't separate two voices") — never a loop.
  if (clusters.length < 2) {
    return { decided: false, reason: "single-cluster", clusterIds };
  }
  // Clusters exist but carry no usable text to reason over.
  if (clusters.every((c) => c.tokens.size === 0)) {
    return { decided: false, reason: "no-signal", clusterIds };
  }

  // ── 1. Cross-match to the known agent turns (ground truth when present) ──
  const knownTurns = args.knownAgentTurns.filter((t) => t.trim().length > 0);
  const knownTokens =
    knownTurns.length >= KNOWN_MIN_TURNS ? contentTokens(knownTurns.join(" ")) : new Set<string>();
  if (knownTokens.size >= KNOWN_MIN_TOKENS) {
    let top: { id: string; sim: number } | null = null;
    let secondSim = 0;
    for (const c of clusters) {
      const sim = overlap(c.tokens, knownTokens);
      if (!top || sim > top.sim) {
        secondSim = top ? top.sim : secondSim;
        top = { id: c.speakerId, sim };
      } else if (sim > secondSim) {
        secondSim = sim;
      }
    }
    if (top && top.sim >= CROSS_MIN_SIM && top.sim - secondSim >= CROSS_MIN_MARGIN) {
      return {
        decided: true,
        agentSpeakerId: top.id,
        confidence: Math.min(1, top.sim - secondSim),
        source: "cross-match",
      };
    }
  }

  // ── 2. Content-tell tally (net seller signal per cluster) ──
  const nets = new Map<string, number>();
  for (const id of clusterIds) nets.set(id, 0);
  for (const s of args.diarized) {
    const g = guessSpeakerFromContent(s.text);
    if (g === "agent") nets.set(s.speakerId, (nets.get(s.speakerId) ?? 0) + 1);
    else if (g === "customer") nets.set(s.speakerId, (nets.get(s.speakerId) ?? 0) - 1);
  }
  const ranked = Array.from(nets.entries()).sort((a, b) => b[1] - a[1]);
  const winner = ranked[0]; // always present — clusters.length >= 2 is guaranteed above
  const runnerNet = ranked[1]?.[1] ?? 0;
  // Decide only when the winner is a POSITIVE seller signal, the runner-up is not, and
  // the gap is clear — otherwise it's a coin flip and we must not save a wrong label.
  if (winner && winner[1] > 0 && runnerNet <= 0 && winner[1] - runnerNet >= TELL_MIN_GAP) {
    return {
      decided: true,
      agentSpeakerId: winner[0],
      confidence: Math.min(1, (winner[1] - runnerNet) / 5),
      source: "content-tell",
    };
  }

  // Two voices present, but neither signal is confident enough to write a label.
  return { decided: false, reason: "ambiguous", clusterIds };
}
