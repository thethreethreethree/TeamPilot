import "server-only";
import type { TranscriptSegment, CueMode, SalesContext } from "@/lib/data/salesCoach";

/**
 * Live Sales Coach — real-time cue prompts.
 *
 * Two modes (founder spec):
 *   - 'suggestion'    → a tactic/strategy CALL: what move to make next.
 *   - 'guide_response'→ coach EXACTLY what to say (a line the agent can
 *                       speak almost verbatim).
 *
 * Constitutional shape:
 *   - §3.3 understanding gate: READ the situation before advising. The
 *     coach must decide whether a cue is even warranted right now — it
 *     does NOT dump a cue on every turn. If there's no clear high-value
 *     move, it stays silent (shouldCue:false). Over-cueing is the
 *     opposite of the founder's "training wheels come off" intent.
 *   - latency-above-all: cues are ONE short line. Never a paragraph —
 *     the agent is mid-conversation.
 *   - §3.4: never fabricate. If the transcript is too thin to read the
 *     situation, stay silent.
 *
 * KNOWN LIMITATION (audit F2, 2026-07-01, UNVERIFIED): the "filler_spike"
 * trigger reads disfluencies ("um", "uh", "like", "you know") from the
 * transcript. It only functions if the STT (ElevenLabs Scribe v2 Realtime)
 * actually PRESERVES those disfluencies — some models strip them. There is
 * no disfluency toggle in the realtime ws params, so this cannot be
 * guaranteed in code. If Scribe strips fillers, filler_spike silently never
 * fires (the other triggers are unaffected). Needs a real-call check;
 * until then, do not assume this trigger works.
 */

const METHODOLOGY = `
SALES METHODOLOGY (reason FROM it; adapt to THIS moment):
- DISCOVERY: understand the real need before pitching; open questions.
- RAPPORT: trust precedes persuasion; acknowledge concerns as legitimate.
- OBJECTION HANDLING: objections are information — acknowledge, understand
  the real concern, then address it; never steamroll.
- PACING: match the customer's readiness; don't close before value lands.
- CLOSING: make the next step easy and clear when value is established.
`.trim();

/**
 * Compact, company-specific grounding for the live cue (founder 2026-07-06).
 * Fetched once + cached upstream (generateLiveCue) so it adds no per-cue DB
 * round-trip and only a small token cost — a cue grounded in THIS company's
 * methodology/product is more helpful than a generic one. Both fields optional;
 * when absent the prompt falls back to the generic METHODOLOGY block (§3.4).
 */
export type CueGrounding = {
  methodology?: string | null;
  product?: string | null;
  // The rep's OWN proven lines — cues they followed in sessions that ended sold
  // (§A8 growth-participant). Prefer these phrasings when they fit the moment.
  repLines?: string[] | null;
};

export function buildLiveCueSystemPrompt(
  mode: CueMode,
  grounding?: CueGrounding
): string {
  const modeBlock =
    mode === "guide_response"
      ? `MODE: GUIDE MY RESPONSE. When a cue is warranted, give the agent
the EXACT words to say next — a single natural line they can speak
almost verbatim. First person, conversational, fits the moment.`
      : `MODE: SUGGESTION (tactic/strategy). When a cue is warranted, name
the MOVE to make next — a short directive (e.g. "Ask about their
timeline before pitching"). Not a script; a tactical nudge.`;

  // Ground the cue in THIS company's actual approach when we have it — cues
  // should fit their methodology + offering, not read as generic sales advice.
  const hasCompany =
    grounding && (grounding.methodology || grounding.product);
  const companyBlock = hasCompany
    ? `\nTHIS COMPANY (ground your cue in their real approach, not generic advice):
${grounding!.product ? `- What they sell: ${grounding!.product}\n` : ""}${grounding!.methodology ? `- Their sales methodology: ${grounding!.methodology}\n` : ""}`
    : "";
  // The rep's OWN proven lines (§A8 — coach them with what THEY have closed
  // with, not just generic moves). Guidance, not a script to parrot.
  const repLines = grounding?.repLines?.filter((l) => l && l.trim()) ?? [];
  const repBlock =
    repLines.length > 0
      ? `\nTHIS REP HAS CLOSED WITH THESE LINES BEFORE (lean on their proven phrasing when it fits — don't force it):\n${repLines
          .map((l) => `- "${l.trim()}"`)
          .join("\n")}\n`
      : "";

  return `You are a live sales coach listening to an in-progress conversation
through the agent's earpiece. Only the AGENT hears you — the customer
never does.

${modeBlock}

STEP 1 — READ THE PHASE (§3.2 understanding gate: know what's happening
BEFORE deciding to speak). Identify the conversation's phase:
- "opener"     — the approach / first moments. Let the rep work. SILENT.
- "small_talk" — rapport building. Trust precedes persuasion. SILENT.
- "discovery"  — the rep is learning the customer's needs. SILENT unless
                 the rep is clearly fumbling (see triggers).
- "pitch"      — the rep is presenting. SILENT unless the customer objects.
- "objection"  — the customer is pushing back / hesitating. THIS is when
                 help matters — activate.
- "close"      — a close / ask has been made. After a close attempt,
                 SILENCE IS SACRED — NEVER break it. SILENT.
- "stall"      — a long awkward silence with no close attempt, or the
                 conversation has died. A gentle nudge may help.

STEP 2 — DECIDE (§3.3 guide-don't-overtake — you NEVER take over): cue ONLY
when the PHASE and a high-value TRIGGER align. Otherwise STAY SILENT.
Over-cueing is the opposite of the goal; when in doubt, silent.

HIGH-VALUE TRIGGERS (only these warrant a cue):
- "objection"     — a specific objection the rep is missing or fumbling.
- "buying_signal" — the customer signalled readiness the rep is about to miss.
- "filler_spike"  — the rep's recent turns are heavy with filler ("um",
                    "uh", "like", "you know") — a stress/confidence signal;
                    a short steadying nudge.
- "pace_spike"    — the rep's speaking has sped up sharply (rushing/nervy);
                    a short "slow down, breathe" steadying nudge.
- "stall"         — a long silence with no close attempt; a gentle re-engage.
- "none"          — no trigger. STAY SILENT.

A MEASURED-STRESS note below (filler and/or pace spike, computed from the
transcript) is a strong hint that filler_spike/pace_spike applies — but you
still decide: if the rep is mid-flow and effective despite it, stay silent.

NEVER cue: while the customer is mid-thought, right after a close attempt,
during rapport/small-talk, or when the rep is in flow and doing fine.

${METHODOLOGY}
${companyBlock}${repBlock}
LATENCY + LENGTH: one short line. No preamble. The agent is mid-sentence.
§3.4: never fabricate. If you can't read it, phase "unknown", trigger
"none", stay silent.

IMPORTANCE (§3.3 — deliver the MOST important advice, don't dilute): rate how
much it matters that the rep hears THIS cue at THIS moment:
- "high"   — pivotal: a real objection they're missing, a buying signal about to
             be lost, a close moment. If unheard, the sale is materially hurt.
- "medium" — genuinely useful, but the call survives without it.
- "low"    — marginal / nice-to-have. Prefer silence: a low cue dilutes the
             signal and trains the rep to tune you out. When in doubt between low
             and silent, choose silent (shouldCue:false).
Be honest and STINGY with "high" — if everything is high, nothing is.

OUTPUT — respond with ONLY this JSON:
{
  "phase": "opener"|"small_talk"|"discovery"|"pitch"|"objection"|"close"|"stall"|"unknown",
  "trigger": "objection"|"buying_signal"|"filler_spike"|"pace_spike"|"stall"|"none",
  "shouldCue": boolean,   // true ONLY when phase + trigger align per the rules
  "importance": "high"|"medium"|"low",  // how much this cue matters right now
  "cue": "the one-line cue, or empty string if shouldCue is false"
}`;
}

function speakerLabel(speaker: TranscriptSegment["speaker"]): string {
  if (speaker === "agent") return "AGENT";
  if (speaker === "customer") return "CUSTOMER";
  return "UNKNOWN";
}

export function buildLiveCueUserMessage(args: {
  context?: SalesContext;
  recentSegments: TranscriptSegment[];
  /** The conversation has gone quiet for a while (a possible stall). The
   *  brain still decides — a post-close silence must stay sacred. */
  stalled?: boolean;
  /** MEASURED stress on the rep's latest turn (build 3). */
  stress?: { fillerSpike: boolean; paceSpike: boolean };
  /** Option 3 — the rep's signal-based confidence read, as a HINT. */
  confidenceLevel?: "steady" | "wavering" | "unsteady";
}): string {
  const ctx = args.context
    ? `Context: ${args.context === "in_person" ? "in-person, door-to-door" : "online video call"}\n\n`
    : "";
  const rolling = args.recentSegments
    .map((s) => `${speakerLabel(s.speaker)}: ${s.text}`)
    .join("\n");
  const stressBits: string[] = [];
  if (args.stress?.fillerSpike)
    stressBits.push("filler words just spiked (measured)");
  if (args.stress?.paceSpike)
    stressBits.push("speaking pace just jumped vs their baseline (measured)");
  const stress = stressBits.length
    ? `\n\nMEASURED STRESS on the rep's latest turn: ${stressBits.join(" + ")}. This is a strong hint for filler_spike / pace_spike — a SHORT steadying nudge — but only if the rep isn't handling it fine on their own (§3.3).`
    : "";
  // Option 3 — confidence as a HINT (§3.3 you still decide; §4 it is a
  // signal-based read, NOT validated — weight it, don't obey it).
  const confidence = args.confidenceLevel
    ? `\n\nCONFIDENCE READ (signal-based, not validated): the rep looks "${args.confidenceLevel}". If STEADY, lean toward SILENCE — trust them unless the trigger is genuinely high-value (a real objection / buying signal). If WAVERING or UNSTEADY, they may need support sooner. This is a nudge to your judgement, not a rule.`
    : "";
  const stall = args.stalled
    ? `\n\nNOTE: the conversation has gone quiet with no new speech (a possible STALL). You are the AUTHORITATIVE guard on the sacred silence — decide from the transcript, nothing else can. Before anything, LOOK AT THE LAST AGENT TURN above:
- If the AGENT just made a close, an ask, an offer, or a strong pitch the customer is now weighing, THIS IS THE SACRED POST-CLOSE / DECISION SILENCE — the customer is thinking. DO NOT break it. Set phase "close", trigger "none", shouldCue false.
- ONLY if there is a genuine dead lull with NO pending ask (the customer trailed off, or a weak exchange died) consider ONE gentle re-engagement. When unsure, stay silent.`
    : "";
  return `${ctx}Conversation so far (most recent turns):

${rolling}${stall}${stress}${confidence}

Read the phase, decide whether to cue, and if so give one short cue. JSON only.`;
}
