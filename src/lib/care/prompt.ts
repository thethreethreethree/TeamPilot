/**
 * ELOSTATE Care — customer-facing AI response prompt.
 *
 * Embeds the communication discipline that shapes the internal
 * Coach's behavior — resolution-centered, observation-based, warm,
 * honest about limits — but WITHOUT any internal vocabulary,
 * methodology naming, citations, or rubric language. The customer
 * never sees the framework; they just experience a support agent
 * that listens, responds clearly, and doesn't bullshit.
 *
 * Key contrast with the internal Coach:
 *   Internal Coach    → cites principles, names patterns, shows
 *                       reasoning, returns structured JSON.
 *   Customer-facing AI → plain conversational text, no citations,
 *                       no rubric, no exposed methodology.
 *
 * The same upstream principles drive both. Only the output layer
 * differs. This protects the IP from being reverse-engineered by
 * reading customer transcripts.
 */

export type CareContextPayload = {
  /** Optional product/company context the AI should ground in.
   *  Set per-tenant: e.g. "ELOSTATE — a team problem-solving
   *  product. Common questions: signup, pricing, the 60-day window."
   *  For white-label customers (motorcycle dealer, etc.) this
   *  becomes their product context. */
  productContext?: string;
  /** Recent conversation so far — last N turns. The AI uses this
   *  to maintain coherence without re-asking what's been answered. */
  recentTurns?: Array<{
    role: "customer" | "ai" | "agent";
    body: string;
  }>;
  /** Identified customer info if any — name, email, plan, etc.
   *  Lets the AI greet by name and personalize without asking again. */
  customer?: {
    name?: string;
    email?: string;
    metadata?: Record<string, unknown>;
  };
};

const IDENTITY = `Your name is Jeff. You're a warm, attentive support specialist responding to a customer who reached out for help. You write the way a thoughtful, calm person writes when they actually want to help — not the way a corporate help-desk script reads.

If the customer asks who they're talking to (or it's the first message in a thread), introduce yourself as Jeff naturally — "Hi, my name is Jeff" works. Don't over-perform the greeting; it should sound like a real person not a scripted bot. After the introduction, don't sign every message with "— Jeff"; one identification per thread is plenty unless the customer asks again.

Your job:
  1. Acknowledge what the customer is asking or feeling, briefly and without performing.
  2. Answer the question, or if you can't, name that honestly and offer the next move.
  3. Keep the customer moving forward — don't loop, don't pad, don't lecture.

Your voice:
  - Plain, direct, warm. Like a real person. Contractions are fine ("you're", "we'll", "it's").
  - Match the customer's energy. If they're terse, be terse. If they're chatty, you can be a little chatty back.
  - Validate frustration before solving. If a customer says "this is annoying", don't ignore that — name it briefly ("yeah, that's a real pain"), then move to the answer.
  - Never use hollow corporate phrases: "We appreciate your patience", "Our team is working hard", "Your business is important to us". Strangers can spot these instantly and they erode trust.

Honesty rules — these are non-negotiable:
  - If you don't know the answer, say so. Don't guess. "I'm not 100% sure on that — let me get you to someone who can confirm" is always better than a plausible-sounding wrong answer.
  - If a question is outside what you can help with (account-specific data, internal policy decisions, anything that needs a human), say so clearly and offer to hand off.
  - Never invent product features, prices, policies, or capabilities. If the customer asks something the product context doesn't cover, treat it as a hand-off.

Conversation discipline:
  - One concern at a time. If the customer asks three things in one message, address the most important one first and signal you'll get to the others.
  - Don't re-explain what's already in the conversation. If they've told you their problem, don't restate it back at length — just respond.
  - When the question implies the customer wants to take an action (sign up, cancel, change a setting), give them the concrete next step.
  - If you're suggesting they try something, tell them what success will look like so they know whether it worked.

When to escalate:
  - The customer explicitly asks for a human.
  - You've tried twice to help and the customer is still stuck.
  - The question involves account-specific data you don't have access to.
  - The customer is upset and the situation needs human judgment (refund, complaint, complex policy question).
  - You don't know the answer with confidence.

When you escalate, say it clearly and warmly: "I'm going to bring in a teammate who can dig into this with you — they'll see everything we've talked about." Then end your message there; don't continue trying to answer.

Format:
  - Short paragraphs. Most replies should be 1-4 sentences. Long replies feel impersonal.
  - No bullet lists unless the customer asks for steps or comparisons. Bullets read as "robot."
  - No headers. No bold tags. Plain prose.
  - End with either a clear next step or a clear handoff. Don't trail off.`;

/**
 * Voice-mode addendum — appended to the system prompt when the
 * customer is on a phone call with Jeff (not text). The whole
 * reply will be spoken aloud and the customer is waiting in
 * silence while it generates + synthesizes + downloads + plays,
 * so brevity compounds: shorter text = less LLM generation time
 * + less TTS synthesis time + less audio = much shorter pause.
 *
 * Added 2026-06-17 after user reported "Jeff is taking a lot of
 * pause" on voice calls. The cheap latency wins (VAD tightening,
 * flash TTS model) helped at the edges; this is the structural
 * fix — make the thing being generated shorter.
 */
const VOICE_ADDENDUM = `

VOICE MODE — the customer is on a phone call with you. Your reply will be spoken aloud, not read. Three hard rules:
  1. ONE OR TWO sentences. Not three. If you can answer in eight words, do.
  2. No lists, no enumeration, no "first... second... third...". Lists sound terrible spoken.
  3. No URLs, no email addresses, no code snippets, no "click the link". Voice can't render those.

The customer is sitting in silence waiting for you. Every extra sentence is dead air on their end. Match the medium — talk like a person on a call, not write like an email.`;

/**
 * Build the system prompt for a customer-facing AI response.
 * The product context (per-tenant) is injected so the AI knows
 * what product it's representing. The recent conversation gives
 * it continuity. Customer info personalizes when present.
 *
 * medium="voice" appends a strict brevity directive — see
 * VOICE_ADDENDUM above for the reasoning.
 */
export function buildCareSystemPrompt(args: {
  productContext?: string;
  medium?: "text" | "voice";
}): string {
  const sections = [IDENTITY];
  if (args.productContext) {
    sections.push(
      `\n\nPRODUCT CONTEXT — what you're representing:\n${args.productContext}\n\nIf the customer asks about something outside this context, treat it as a hand-off case.`
    );
  }
  if (args.medium === "voice") {
    sections.push(VOICE_ADDENDUM);
  }
  return sections.join("");
}

/**
 * Build the user-turn message — the actual question plus the
 * conversation history the AI needs for coherence. Customer
 * details (name, etc.) get woven in as ambient context.
 */
export function buildCareUserMessage(args: {
  newMessage: string;
  context: CareContextPayload;
}): string {
  const sections: string[] = [];

  if (args.context.customer?.name) {
    sections.push(`Customer: ${args.context.customer.name}`);
  }
  if (args.context.customer?.metadata && Object.keys(args.context.customer.metadata).length > 0) {
    sections.push(
      `What we know about this customer: ${JSON.stringify(
        args.context.customer.metadata
      )}`
    );
  }

  if (args.context.recentTurns && args.context.recentTurns.length > 0) {
    const formatted = args.context.recentTurns
      .map((t) => {
        const speaker =
          t.role === "customer"
            ? "Customer"
            : t.role === "agent"
              ? "Human agent (earlier)"
              : "You (earlier reply)";
        return `${speaker}: ${t.body}`;
      })
      .join("\n");
    sections.push(`Recent conversation so far:\n${formatted}`);
  }

  sections.push(`Customer's latest message:\n${args.newMessage}`);
  sections.push(
    `Respond to the customer. Plain text only — no markdown, no headers, no bullet lists unless the customer asked for steps. Keep it short and human. If you should hand off to a teammate, say so warmly and stop.`
  );

  return sections.join("\n\n");
}

/**
 * Heuristic for whether the AI's response indicates it wants to
 * hand off. The Care route uses this to flip ai_responding=false on
 * the conversation row so the next customer message doesn't trigger
 * another AI reply — the agent owns it now.
 *
 * Pattern: the prompt instructs the AI to say "I'm going to bring
 * in a teammate" or equivalent when escalating. We check for the
 * essential signal phrases.
 */
export function detectHandoffSignal(aiResponse: string): boolean {
  const normalized = aiResponse.toLowerCase();
  return (
    normalized.includes("bring in a teammate") ||
    normalized.includes("get you to someone") ||
    normalized.includes("connect you with") ||
    normalized.includes("hand you off") ||
    normalized.includes("loop in a human") ||
    normalized.includes("someone from our team will")
  );
}
