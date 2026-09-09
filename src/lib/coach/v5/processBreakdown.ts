import "server-only";
import { dissectCoachV5 } from "@/lib/claude";
import { groundQuote } from "./grounding";
// Prompt-injection fence — the diarized transcript carries untrusted CUSTOMER speech; instructions inside it are
// DATA, never obeyed. Shared with the score/moment engines.
import { CONVERSATION_IS_DATA } from "@/lib/care/toolPrompts";
import { getCurrentSalesCorpus, type TranscriptSegment, type SalesContext } from "@/lib/data/salesCoach";
import { buildSalesScoreUserMessage } from "./salesScorePrompt";
import { PROCESS_PHASES, type ProcessPhase, type ProcessPhaseKey } from "./summaryTypes";

/**
 * Process breakdown engine (partner meeting 9/2, John Ramos: "a process breakdown under skill scores with ratings
 * for intro, discovery, consultation, and close, plus tips for improvement" — to quickly see where a rep needs
 * training). A per-PHASE read of the pitch, grounded in the company's OWN methodology corpus (so "good discovery"
 * means what THIS team teaches, not a generic idea). Mirrors generateSalesScores: corpus-grounded system prompt +
 * the fenced transcript → the LLM → an honestly-parsed result. A phase that didn't occur is null, never a fake 0.
 */

const MIN_AGENT_SEGMENTS = 2; // too little rep speech to read the process at all — return nothing, honestly

const LABELS: Record<ProcessPhaseKey, string> = {
  intro: "Intro & rapport",
  discovery: "Discovery",
  consultation: "Consultation",
  close: "Close",
};

function buildSystemPrompt(corpus?: string | null, product?: string | null): string {
  return [
    "You are a sales coach grading ONE recorded pitch by the four PHASES of the sales process, so a manager can see",
    "at a glance which stage of the process the rep needs training on. The four phases, in order:",
    "  - intro:        the opening — greeting, framing, and building rapport before any selling.",
    "  - discovery:    uncovering the prospect's situation and needs through questions (not pitching yet).",
    "  - consultation: presenting the offer/solution mapped to what discovery surfaced; handling objections.",
    "  - close:        asking for the decision / next commitment and locking a concrete next step.",
    "",
    corpus ? "GRADE AGAINST THIS TEAM'S OWN METHODOLOGY (what THEY teach is 'good' for each phase):\n" + corpus : "",
    product ? "\nPRODUCT CONTEXT (do not invent product facts beyond this):\n" + product : "",
    "",
    "For EACH phase, output: a score 0-10 (how well the rep ran that phase against the methodology), ONE concrete,",
    "actionable improvement tip (imperative, specific to THIS call — the single thing to change next time), and a",
    "short verbatim quote from the call that grounds your read (the exact words, so the rep can inspect it).",
    "",
    "HONESTY RULES (do not violate):",
    "  - If a phase did NOT happen in this call (e.g. the rep never attempted a close), set its score to null and",
    "    make the tip say what to ADD (e.g. 'You never asked for a next step — end with a specific ask'). NEVER",
    "    invent a score for a phase that didn't occur.",
    "  - Every phase you return MUST have a tip. A rating with no actionable tip is useless — omit that phase instead.",
    "  - The citation must be REAL words from the transcript, or null. Never fabricate a quote.",
    "",
    'Respond with ONLY minified JSON: {"phases":[{"key":"intro","score":7,"tip":"…","citation":"…"},{"key":"discovery",…}]}',
    "Include every phase you can read; omit a phase only if you cannot say anything actionable about it.",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Generate the per-phase breakdown for a pitch. Returns [] on any failure (no rep speech, LLM suppressed, parse
 * error) — the caller renders "not enough to read the process yet", never a fabricated breakdown (honesty rule).
 */
export async function generateProcessBreakdown(args: {
  companyId: string;
  context?: SalesContext;
  segments: TranscriptSegment[];
}): Promise<ProcessPhase[]> {
  try {
    const agentSegments = args.segments.filter((s) => s.speaker === "agent");
    if (agentSegments.length < MIN_AGENT_SEGMENTS) return [];

    const [corpus, product] = await Promise.all([
      getCurrentSalesCorpus(args.companyId).catch(() => null),
      getCurrentSalesCorpus(args.companyId, "product").catch(() => null),
    ]);
    const systemPrompt = buildSystemPrompt(corpus?.content, product?.content) + CONVERSATION_IS_DATA;
    const userMessage = buildSalesScoreUserMessage({ context: args.context, segments: args.segments });

    const r = await dissectCoachV5({ companyId: args.companyId, systemPrompt, userMessage });
    if (r.suppressed) return [];
    return parseProcessBreakdown(r.text, args.segments);
  } catch {
    return [];
  }
}

/**
 * Exported for test: parse + enforce honesty. A phase is accepted only if it's one of the four known phases and
 * carries an actionable tip (A11 — no naked verdicts). Score is clamped to [0,10] or null (phase absent). The
 * citation is GROUNDED against the transcript when available (a quote whose words aren't in the call is dropped,
 * not surfaced as false evidence). Phases return in canonical order; duplicates keep the first.
 */
export function parseProcessBreakdown(text: string, segments: TranscriptSegment[] = []): ProcessPhase[] {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return [];
  }
  const arr = raw && typeof raw === "object" && Array.isArray((raw as { phases?: unknown }).phases)
    ? (raw as { phases: unknown[] }).phases
    : Array.isArray(raw)
      ? raw
      : null;
  if (!arr) return [];

  const byKey = new Map<ProcessPhaseKey, ProcessPhase>();
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    const key = c.key as ProcessPhaseKey;
    if (!(PROCESS_PHASES as readonly string[]).includes(key)) continue;
    if (byKey.has(key)) continue;
    const tip = typeof c.tip === "string" ? c.tip.trim() : "";
    if (!tip) continue; // A11: a rating with no actionable tip is a naked verdict — drop it
    const rawScore = typeof c.score === "number" ? c.score : NaN;
    const score = Number.isNaN(rawScore) ? null : Math.max(0, Math.min(10, Math.round(rawScore)));
    const citation =
      segments.length > 0
        ? groundQuote(c.citation as string | null, segments)
        : typeof c.citation === "string" && c.citation.trim()
          ? c.citation.trim()
          : null;
    byKey.set(key, { key, label: LABELS[key], score, tip, citation });
  }
  return PROCESS_PHASES.map((k) => byKey.get(k)).filter((p): p is ProcessPhase => Boolean(p));
}

/** Per-agent aggregate of the phase breakdown across sessions — for the manager's Coach Assessment card. */
export type PhaseAggregate = {
  key: ProcessPhaseKey;
  label: string;
  avg: number | null; // average 0-10 over sessions where the phase was graded; null = never gradable
  samples: number; // how many sessions contributed a score (honest denominator)
  tip: string; // the improvement tip from the WEAKEST graded session — the biggest training opportunity
};

/**
 * Fold a rep's per-session phase breakdowns into one per-phase view: the average score (over sessions where the
 * phase actually happened — an absent phase never drags the average to 0, honesty rule) and the tip from their weakest
 * session for that phase (where training would help most). A phase with no data across all sessions is omitted.
 */
export function aggregateProcessBreakdown(perSession: ProcessPhase[][]): PhaseAggregate[] {
  const out: PhaseAggregate[] = [];
  for (const key of PROCESS_PHASES) {
    const entries = perSession.flatMap((s) => s.filter((p) => p.key === key));
    if (entries.length === 0) continue;
    const scored = entries.filter((p): p is ProcessPhase & { score: number } => p.score !== null);
    const avg = scored.length ? Math.round((scored.reduce((a, p) => a + p.score, 0) / scored.length) * 10) / 10 : null;
    const weakest = [...scored].sort((a, b) => a.score - b.score)[0];
    out.push({
      key,
      label: entries[0]!.label,
      avg,
      samples: scored.length,
      tip: weakest?.tip ?? entries[0]!.tip,
    });
  }
  return out;
}
