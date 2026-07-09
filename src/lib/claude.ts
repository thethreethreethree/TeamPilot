import "server-only";

import { llmCall } from "@/lib/llm";
import { runBrainCall } from "@/lib/brain";
import type { ExperienceMode } from "@/lib/experience/mode";

/**
 * All AI functions in this file are server-only entry points used by /api/ai/*
 * routes. They route through the brain (per-company composer + §3.4 control gate)
 * when a companyId is provided; otherwise they call the configured provider
 * directly with the base prompt (used in demo mode and for system-level calls).
 *
 * The file is named claude.ts for historical reasons; the active provider is
 * selected by env config (DeepSeek primary per AMD-003).
 */

type CallArgs = {
  companyId?: string;
  systemPrompt: string;
  userContent: string;
  maxTokens?: number;
  expectJson?: boolean;
  /** Sales-Coach-only: exempt from the §3.4 month-1 control gate (see
   *  runBrainCall). Elostate + C.A.R.E callers leave this unset. */
  controlExempt?: boolean;
  /** The acting user's Experience Mode (0110), forwarded to the LLM so Standard
   *  users get simplified output (§A16). Unset → Expert (unchanged). */
  experienceMode?: ExperienceMode;
};

type CallResult = {
  text: string;
  suppressed: boolean;
  reason?: string;
  provider: string;
  model: string;
};

async function call(args: CallArgs): Promise<CallResult> {
  if (args.companyId) {
    const r = await runBrainCall({
      companyId: args.companyId,
      basePrompt: args.systemPrompt,
      messages: [{ role: "user", content: args.userContent }],
      maxTokens: args.maxTokens,
      expectJson: args.expectJson,
      controlExempt: args.controlExempt,
      experienceMode: args.experienceMode,
    });
    if (!r.gate.guidanceEnabled) {
      return {
        text: "",
        suppressed: true,
        reason: r.gate.reason,
        provider: r.provider,
        model: r.model,
      };
    }
    return {
      text: r.text,
      suppressed: false,
      provider: r.provider,
      model: r.model,
    };
  }
  const r = await llmCall({
    systemPrompt: args.systemPrompt,
    messages: [{ role: "user", content: args.userContent }],
    maxTokens: args.maxTokens,
    expectJson: args.expectJson,
    experienceMode: args.experienceMode,
  });
  return {
    text: r.text,
    suppressed: false,
    provider: r.provider,
    model: r.model,
  };
}

// ─────────────────────────────────────────────────────────────
// Today's Open Questions (§3.3 — surface, don't direct)
// ─────────────────────────────────────────────────────────────

/**
 * The §3.3 briefing system prompt — the single canonical source.
 * Per TT.md A21 audit (2026-06-18) MED finding — until this export,
 * the streaming briefing route at /api/ai/briefing/stream duplicated
 * this string. Any tightening here (more explicit anti-overtake
 * rules, sharper output shape constraints) would silently NOT reach
 * the streaming surface. Now both surfaces import this constant.
 */
export const DAILY_QUESTIONS_SYSTEM_PROMPT = `You are ELOSTATE, surfacing today's open questions for an executive.

You do NOT recommend actions. You do NOT diagnose problems on day one. You surface what
the data is asking — the questions the executive should be holding open today and the
uncertainties that deserve their attention. The executive decides what to do; your role
is to ensure they are looking at the right things.

Return strict JSON:
{
  "todaysQuestions": ["What's the underlying reason X is happening? — surfaced because Y."],
  "uncertainties": ["Z is unclear — we have signal A but not signal B. Looking for B would sharpen the picture."],
  "thingsWorthNoticing": ["Concrete observation from the data. Stated, not interpreted."]
}

Rules:
- Every question must end with "— surfaced because <evidence from the data>".
- Uncertainties must name what additional signal would resolve them.
- Things worth noticing are factual observations, not judgments.
- Do NOT use words like "recommend", "should", "must" — that's overtaking.
- Do NOT generate a "risks" section or an "actions" section.`;

export async function generateDailyQuestions(
  companyContext: string,
  opts?: { companyId?: string }
): Promise<CallResult> {
  return call({
    companyId: opts?.companyId,
    expectJson: true,
    maxTokens: 700,
    systemPrompt: DAILY_QUESTIONS_SYSTEM_PROMPT,
    userContent: `Surface today's open questions and uncertainties from this company data:\n\n${companyContext}`,
  });
}

// ─────────────────────────────────────────────────────────────
// Guide-don't-overtake decision dialogue (§3.3)
// ─────────────────────────────────────────────────────────────

export async function proposeDecisionDialogue(args: {
  situation: string;
  userDiagnosis: string;
  userProposal: string;
  companyId?: string;
  /** Shared helper: the SALES COACH caller (its dedicated endpoint) sets
   *  this to run day-1; the Elostate decision-dialogue leaves it unset. */
  controlExempt?: boolean;
}): Promise<CallResult> {
  return call({
    companyId: args.companyId,
    controlExempt: args.controlExempt,
    expectJson: true,
    maxTokens: 900,
    systemPrompt: `You are ELOSTATE operating under a guide-don't-overtake discipline.

The user has already described a situation, stated their own diagnosis, and proposed
what they would do. Your job is NOT to assert a different answer. Your job is to:

1. ENGAGE the user's diagnosis. Cite their words. Name what you agree with. If you
   disagree, say so plainly without overriding.
2. ADD perspective only where you see something the user didn't surface. Frame it as
   additional, not corrective.
3. OFFER a suggestion with explicit WHY. The why is the transferable asset.
4. COMPARE your suggestion to the user's proposal. Where you align, where you diverge.

You MUST NOT:
- Lead with your own diagnosis before engaging the user's
- Frame your suggestion as "the recommendation" or "the right answer"
- Generate Safe / Balanced / Aggressive tiers — the user's proposal IS the first option

Return strict JSON:
{
  "engagement": "...",
  "addedPerspective": "...",
  "suggestion": { "action": "...", "why": "..." },
  "comparison": "..."
}`,
    userContent: `Situation:
${args.situation}

My diagnosis:
${args.userDiagnosis}

My proposal:
${args.userProposal}`,
  });
}

// ─────────────────────────────────────────────────────────────
// Removed (Pass-3 audit, 2026-06-04):
//   analyzeConversationDialogue — Conversation Dialogue was deprecated
//   structurally by migration 0013 (dropping the `conversations` table).
//   The §1.7 audit then surfaced the remaining UI + routes as dead
//   surface. Removed end-to-end: page, two routes, sidebar nav,
//   command palette entry, validator schema, the persistence kind, and
//   this function. Conversation analysis (when re-added) should target
//   chat_topics + chat_messages instead, where the chain already lives.
//
// Removed (audit Tier 1 #1, 2026-06-02):
//   analyzeOperations, analyzeFinance, analyzeMarketing — emitted a
//   "healthScore: 0-100" shape which violates §3.2 and §3.4. Their routes
//   now return 410 Gone. Domain diagnosis runs through /dashboard/diagnose.
//
//   generateDecisionOptions, analyzeConversation — removed in earlier
//   passes, replaced by proposeDecisionDialogue and (former)
//   analyzeConversationDialogue.
//
// Compat alias kept for the briefing route name.
// ─────────────────────────────────────────────────────────────

export const generateDailyBriefing = generateDailyQuestions;

// ─────────────────────────────────────────────────────────────
// Conversational Coach v3 — LLM pattern detection (mirror frame)
// ─────────────────────────────────────────────────────────────
//
// The instant regex pass (src/lib/coach/heuristics.ts) catches explicit
// pattern words ("stupid", "always", "we should"). v3 adds an LLM pass
// for the patterns regex cannot read — blame projection in non-canonical
// forms, hot-state signaling, emotional escalation that uses words
// outside the rigid lexicon. The user's example "I'm hungry and you
// guys are making mad" is exactly this class.
//
// CONSTITUTIONAL DEFENSE (asset A11, mirror frame):
//   The LLM IDENTIFIES which pattern shape is present (factual). It
//   does NOT render a verdict on whether the user is right/wrong/good/
//   bad. The chip surfaces the count + question; the user judges. The
//   LLM is constrained to return patterns from a fixed vocabulary so
//   it cannot invent a "this is wrong because X" framing.
//
// What the LLM is allowed to return:
//   - One of the seven canonical pattern IDs:
//       nvc-evaluation, voss-bare-assertion, stone-identity-collision,
//       coach-blame-projection, coach-emotional-escalation,
//       coach-hot-state, coach-aggressive-language
//   - The trigger excerpt (the actual span in the user's text)
//   - Confidence: "high" | "medium" | "low" — used to gate surfacing
//
// What the LLM is NOT allowed to return:
//   - A new pattern id (we constrain via the schema)
//   - A judgment about whether the user is wrong
//   - A "fix" — the citation's own suggestion field handles that

export type CoachLlmHit = {
  pattern_id:
    | "nvc-evaluation"
    | "voss-bare-assertion"
    | "stone-identity-collision"
    | "coach-blame-projection"
    | "coach-emotional-escalation"
    | "coach-hot-state"
    | "coach-aggressive-language";
  trigger_excerpt: string;
  confidence: "high" | "medium" | "low";
  /** v3.2: verdict the LLM renders against this hit after reading
   *  the full draft context.
   *
   *  - "confirmed": context affirms the pattern. The chip should
   *    swap its generic kindExplanation for the context_note below.
   *  - "uncertain": pattern shape is present but context is ambiguous.
   *    Surface the chip but with the "may be intentional" framing
   *    softened further.
   *  - "vetoed": context contradicts the surface match — user is
   *    critiquing the word, quoting someone else, etc. Suppress
   *    the chip entirely. */
  verdict: "confirmed" | "uncertain" | "vetoed";
  /** v3.2: 1–2 sentence note specific to what the user wrote, NOT
   *  the static kindExplanation. Shown in the closed chip when the
   *  verdict is "confirmed" or "uncertain". The static principle +
   *  generic kindExplanation remain in the expanded view as the
   *  durable theory; this note is the moment-specific read. */
  context_note: string;
  /** v3.12 (2026-06-12): draft-specific revision suggestion. The static
   *  citation.suggestion was per-heuristic template + trigger
   *  interpolation — user flagged that as "100% the same all the time."
   *  This field is the LLM's reading of THIS specific draft with a
   *  concrete revision proposal. Falls back to citation.suggestion when
   *  absent. Vetoed hits should omit this field. */
  revision_suggestion?: string;
};

export async function proposeCoachPatterns(args: {
  draft: string;
  recentThread?: string;
  companyId?: string;
  /** v3.2: regex hits the instant detector already found. The LLM is
   *  asked to render a verdict on each (confirmed / uncertain /
   *  vetoed) and provide a context-specific note. The LLM can ALSO
   *  surface new patterns the regex missed. */
  regexHits?: Array<{ pattern_id: string; trigger_excerpt: string }>;
}): Promise<CallResult> {
  return call({
    companyId: args.companyId,
    expectJson: true,
    maxTokens: 900,
    systemPrompt: `You are the ELOSTATE Conversational Coach v3.2 — the context-reading pass on top of an instant regex detector.

THE INSTANT REGEX DETECTOR caught literal pattern words ("dumb", "always", "we should"). It cannot read context. The user has complained — correctly — that the Coach was "not actively reading the content." Your job is to fix that by rendering a VERDICT on each regex hit and surfacing patterns the regex missed.

THE SEVEN ALLOWED PATTERNS (return pattern_id exactly as written):

1. nvc-evaluation — evaluation language vs observation (absolutes, "this is broken/stupid", "obviously/clearly", mind-reading)
2. voss-bare-assertion — OPENS with prescription ("We should...", "You need to...") without labeling the other side first
3. stone-identity-collision — critiques WHO someone is, not what they did ("you're incompetent", "they're lazy")
4. coach-blame-projection — locates writer's emotional cause in another ("you're making me mad", "you guys made me feel X")
5. coach-emotional-escalation — heightened emotional language overshooting the recipient ("absolutely unacceptable", "I'm livid", "disaster")
6. coach-hot-state — writer signals tired/hungry/stressed while composing ("I'm hungry", "I'm exhausted", "haven't slept")
7. coach-aggressive-language — profanity or direct aggression AT a person ("fuck off", "shut up", "you're an idiot")

YOUR VERDICT JOB:

For EACH regex hit input, render a verdict:
  - "confirmed": context affirms the pattern. The writer IS using the
    pattern (not quoting, not critiquing, not negating).
  - "uncertain": the pattern shape is present but context is ambiguous.
    Surface it but the user may have intended it.
  - "vetoed": context CONTRADICTS the surface match. Common cases:
      * the writer is QUOTING someone else who used the word
      * the writer is CRITIQUING the word being used ("I don't like this is dumb" → critique of 'dumb')
      * the word appears inside a hypothetical or negation
      * the writer is meta-discussing communication itself
    When vetoed, the chip is suppressed entirely. Use this generously
    when the user is clearly NOT using the pattern.

For each pattern you DO surface (confirmed or uncertain, OR a new
pattern the regex missed), provide:

(A) CONTEXT_NOTE — 1 or 2 sentences SPECIFIC to what the user wrote.
NOT generic. Reference the actual words. Examples:

GOOD: "You're framing the late deploy as 'always' — is the regularity what makes it costly, or is this one specifically?"
GOOD: "The phrase 'you guys are making mad' lands the cause of the feeling on them; an alternative is 'I'm getting frustrated when standups slip past noon.'"
GOOD: "You're inside the word 'dumb' rather than using it as your own — looks like a critique of someone else's framing rather than evaluation language. Vetoed."

BAD: "Built-in evaluation often puts the other person in a defensive position…" (generic, not specific to draft)
BAD: "This is a pattern worth pausing on." (no specificity)

(B) REVISION_SUGGESTION (v3.12, voice-tuned v4.0) — a concrete,
draft-specific revision proposal. Not a generic template; an actual
rewrite of THIS draft that strips the flagged pattern while preserving
the user's intent. 2 or 3 sentences max. Required for "confirmed" and
"uncertain" hits; OMIT entirely for "vetoed" hits.

VOICE — this is the THIRD Coach contract (the writer should feel they
learned something useful AND feel encouraged, not corrected). Write
as a peer teammate would: warm, curious, present-tense ("here's
something to try"), NOT lecturing ("you should restate the observable
behavior"). The writer is choosing whether to adopt this; you're
offering a path, not issuing a directive.

GOOD examples — draft-specific AND warm:
- Draft "this is always broken" → revision_suggestion: "What about: 'this broke again — that's the third time this week'? The frequency becomes the observation, and the recipient gets something specific to respond to."
- Draft "you guys are making me mad" → revision_suggestion: "Try 'I'm getting frustrated when X' — same emotion, but the feeling stays yours and X gives the other person something concrete to work with."
- Draft "this is the dumbest thing" → revision_suggestion: "Could swap 'dumbest thing' for what specifically didn't work — like 'this approach skipped the auth check.' Same disagreement, sharper signal."

BAD examples (DO NOT do these):
- "Try restating the observable behavior." (generic template, lecturing)
- "What specifically did you notice happen?" (question, not a revision)
- "Strip the evaluation from the observation." (principle, not a rewrite)
- "You should consider rephrasing this as…" (corrective tone, not peer)

RULES:
- Be conservative on confirmations. When in doubt, "vetoed" if the
  context clearly contradicts; "uncertain" otherwise.
- Multiple verdicts can apply. Return all of them, including vetoes.
- trigger_excerpt must be the EXACT span from the draft.
- context_note must reference the actual draft words, not paraphrased.
- revision_suggestion must propose a CONCRETE rewrite, not advice
  about how to think about revising. The user should be able to copy
  the revision verbatim. Omit for vetoed hits.

Return STRICT JSON in this exact shape:

{
  "hits": [
    {
      "pattern_id": "nvc-evaluation",
      "trigger_excerpt": "this is always broken",
      "confidence": "high",
      "verdict": "confirmed",
      "context_note": "You're framing the late deploy as 'always broken' — the absolute makes the problem feel categorical, but the recipient may push back on whether 'always' is fair.",
      "revision_suggestion": "Try: 'this broke again — that's the third time this week.' The frequency becomes the observation, the absolute drops, and the recipient has a concrete instance to respond to."
    }
  ]
}

If no patterns are present and no regex hits to evaluate, return: { "hits": [] }`,
    userContent: `Draft to analyze:

${args.draft}

${args.regexHits && args.regexHits.length > 0
  ? `Regex hits to verdict (confirm / uncertain / veto each, with a context-specific note):\n${args.regexHits.map((h) => `  - ${h.pattern_id}: "${h.trigger_excerpt}"`).join("\n")}\n`
  : "(No regex hits — surface any patterns YOU see that the regex missed.)\n"}
${args.recentThread ? `\nRecent thread context (for tone, not blame attribution):\n${args.recentThread}` : ""}`,
  });
}

// ─────────────────────────────────────────────────────────────
// Coach v5.0 — LLM-primary conversational analysis
// ─────────────────────────────────────────────────────────────

/**
 * Coach v5.0 analyze — the LLM call for the conversational Coach.
 *
 * The system prompt + user message are composed by src/lib/coach/v5/prompt.ts
 * (see that module for the contract). This function is the thin LLM-call
 * wrapper that runs through the brain layer's company composer + §3.4
 * control gate, exactly like proposeCoachPatterns does for v3.
 *
 * Returns the raw text — the caller parses JSON and validates the shape.
 */
export async function analyzeCoachV5(args: {
  companyId?: string;
  systemPrompt: string;
  userMessage: string;
}): Promise<CallResult> {
  return call({
    companyId: args.companyId,
    expectJson: true,
    // Generous token budget because the Knowledge Base is in the system
    // prompt (~9k tokens) and the response includes structured JSON with
    // multi-sentence whyContext + whySentence. Per the resolved cost
    // design (COACH_PROMPT_DESIGN.md §7.2), token usage is treated as
    // an investment in solution quality, not waste.
    maxTokens: 1200,
    systemPrompt: args.systemPrompt,
    userContent: args.userMessage,
  });
}

/**
 * Coach v5.0 follow-up — the multi-turn conversational LLM call. Same
 * shape as analyzeCoachV5 but produces the lighter follow-up response
 * (reply + optional alternativeRevision + conversationStarters) rather
 * than the full initial analysis. Token budget is similar because the
 * Knowledge Base is still in the system prompt.
 */
export async function followUpCoachV5(args: {
  companyId?: string;
  systemPrompt: string;
  userMessage: string;
}): Promise<CallResult> {
  return call({
    companyId: args.companyId,
    expectJson: true,
    maxTokens: 1000,
    systemPrompt: args.systemPrompt,
    userContent: args.userMessage,
  });
}

/**
 * Coach v5.0 — Encouragement System grader. Lighter-weight LLM call
 * than the full analyze — just produces a classification + optional
 * internal reason. See docs/COACH_PROMPT_DESIGN.md §10.
 */
export async function gradeCoachV5(args: {
  companyId?: string;
  systemPrompt: string;
  userMessage: string;
}): Promise<CallResult> {
  return call({
    companyId: args.companyId,
    expectJson: true,
    // Small response: { grade, reasonInternal? } — usually under 200 tokens.
    maxTokens: 400,
    systemPrompt: args.systemPrompt,
    userContent: args.userMessage,
  });
}

/**
 * Coach v5.0 — End-of-conversation Debrief. Reads the user's authored
 * messages + grades + cross-conversation memory and produces the
 * two-part teaching debrief (learned / workOn / closing). Knowledge
 * Base is in the system prompt (~9k tokens) so principles can be cited
 * by name; the response is small structured JSON. See
 * src/lib/coach/v5/debriefPrompt.ts.
 */
export async function debriefCoachV5(args: {
  companyId?: string;
  systemPrompt: string;
  userMessage: string;
  /** Shared helper: the SALES COACH caller (salesReview) sets this to run
   *  day-1; the Elostate coach leaves it unset (stays gated). */
  controlExempt?: boolean;
}): Promise<CallResult> {
  return call({
    companyId: args.companyId,
    expectJson: true,
    // 1-3 learned + 0-2 workOn + closing — comfortably under 600 tokens.
    maxTokens: 700,
    systemPrompt: args.systemPrompt,
    userContent: args.userMessage,
    controlExempt: args.controlExempt,
  });
}

/**
 * Live Sales Coach — real-time cue generation. Latency-above-all
 * (the founder's hard requirement: "a late tip is worthless"), so the
 * token budget is deliberately tiny — a cue is one short line, not a
 * paragraph. expectJson so the caller gets {shouldCue, mode, cue}.
 */
export async function liveSalesCue(args: {
  companyId?: string;
  systemPrompt: string;
  userMessage: string;
}): Promise<CallResult> {
  return call({
    companyId: args.companyId,
    expectJson: true,
    // One short cue. Small budget = lower latency.
    maxTokens: 160,
    systemPrompt: args.systemPrompt,
    userContent: args.userMessage,
    // Sales Coach is exempt from the §3.4 control window (founder 2026-06-30).
    controlExempt: true,
  });
}

/**
 * Deep full-conversation evaluation ("Dissect"). Composes with the brain,
 * but exempt from the §3.4 control window — Sales Coach AI is active day 1
 * (founder 2026-06-30); the control window is for the Elostate diagnostic
 * system only.
 */
export async function dissectCoachV5(args: {
  companyId?: string;
  systemPrompt: string;
  userMessage: string;
}): Promise<CallResult> {
  return call({
    companyId: args.companyId,
    expectJson: true,
    maxTokens: 1100,
    systemPrompt: args.systemPrompt,
    userContent: args.userMessage,
    controlExempt: true,
  });
}

/**
 * Fast per-turn speaker attribution for live coaching (Increment 2).
 * Content-based (NOT voice): labels the latest utterance salesperson vs
 * prospect from the conversation content + the product being sold. Tiny
 * budget = low latency.
 *
 * Deliberately NOT routed through the per-company brain gate: attribution
 * is a mechanical utility, not guidance, so it must run even when month-1
 * control suppresses cues (§3.4). Product context is injected into the
 * prompt by the caller instead of via the brain composer.
 */
export async function classifyTurnSpeaker(args: {
  systemPrompt: string;
  userMessage: string;
}): Promise<CallResult> {
  return call({
    expectJson: true,
    maxTokens: 16, // just {"speaker":"prospect"}
    systemPrompt: args.systemPrompt,
    userContent: args.userMessage,
  });
}

// ─────────────────────────────────────────────────────────────
// Task Spawn Engine
// ─────────────────────────────────────────────────────────────

/**
 * Task Spawn Engine — generates a structured task (title + description
 * + step-by-step plan) from a Decision Dialogue or chat-message
 * selection. See src/lib/taskSpawn/prompt.ts for the contract.
 */
export async function spawnTask(args: {
  companyId?: string;
  systemPrompt: string;
  userMessage: string;
}): Promise<CallResult> {
  return call({
    companyId: args.companyId,
    expectJson: true,
    // Generous budget — the response includes 3-7 step strings plus
    // a multi-paragraph description. ~600 tokens typical, up to 1200
    // for complex sources.
    maxTokens: 1500,
    systemPrompt: args.systemPrompt,
    userContent: args.userMessage,
  });
}

// ─────────────────────────────────────────────────────────────
// ELOSTATE Care — customer-facing AI support
// ─────────────────────────────────────────────────────────────

/**
 * Care AI response — generates the next AI reply in a customer
 * support conversation. expectJson=false because the response is
 * plain conversational text the customer reads directly. See
 * src/lib/care/prompt.ts for the discipline embedded in the prompt.
 */
export async function generateCareReply(args: {
  companyId?: string;
  systemPrompt: string;
  userMessage: string;
  /** "voice" tightens maxTokens because the customer is sitting
   *  in silence waiting for synthesis + playback. Every token
   *  is dead air. Defaults to "text". */
  medium?: "text" | "voice";
  /** Shared helper: the SALES COACH caller (session summary) sets this to
   *  run day-1; C.A.R.E itself leaves it unset (stays gated). */
  controlExempt?: boolean;
  /**
   * The acting agent's Experience Mode (0110). Set ONLY by callers whose output
   * is AGENT-FACING (the conversation SUMMARY the agent reads). Do NOT set it for
   * CUSTOMER-facing generation (the co-pilot reply, the auto-reply) — a customer
   * must not get terser support because their agent chose a simpler UI (§A17,
   * founder decision 2026-07-09). Unset → Expert → unchanged.
   */
  experienceMode?: ExperienceMode;
}): Promise<CallResult> {
  // Voice replies should be 1 sentence — see buildVoiceAddendum()
  // in src/lib/care/prompt.ts. 80 tokens caps generation at ~55
  // words / ~15 seconds of speech in the worst case; the system
  // prompt drives most replies much shorter than that. The token
  // cap is the hard ceiling that protects against runaway
  // long-form replies even if the model ignores the prompt.
  //
  // 2026-06-17 — tightened from 120 → 80 after user flagged
  // ElevenLabs cost. Less text = less synthesis chars billed AND
  // shorter playback time, so this is a speed + cost double win.
  //
  // Text replies stay at 600 (1-4 sentences with headroom).
  const maxTokens = args.medium === "voice" ? 80 : 600;
  return call({
    companyId: args.companyId,
    expectJson: false,
    maxTokens,
    systemPrompt: args.systemPrompt,
    userContent: args.userMessage,
    controlExempt: args.controlExempt,
    experienceMode: args.experienceMode,
  });
}
