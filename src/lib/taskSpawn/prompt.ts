/**
 * Task Spawn Engine — LLM prompt composition.
 *
 * Generates a structured task (title, description, ordered steps)
 * from one of two context types:
 *   - "decision": a finalized Decision Dialogue (situation, diagnosis,
 *     proposal, system response, chosen path)
 *   - "chat_messages": selected messages from a chat topic plus the
 *     surrounding conversation as context
 *
 * Supports iterative refinement — the user can re-call the spawn
 * route with their previous task draft + an adjustment_prompt, and
 * the LLM revises the existing plan instead of generating fresh.
 *
 * Constitutional grounding embedded in the system prompt:
 *   - §3.3 guide-don't-overtake: the System proposes a structured
 *     task; the admin/user reviews and decides before saving.
 *   - §1.5 holistic: the LLM reads the WHOLE context (whole
 *     conversation, whole decision) even when the focus is narrower
 *     (selected messages, single proposal).
 *   - §3.2 Understanding Gate: the generated task includes a clear
 *     "what" and concrete steps — not vague action items.
 *   - A11 mirror frame: the LLM produces an offered structure; never
 *     decides on the user's behalf.
 */

import type { SpawnContextType, SpawnContextPayload, SpawnedTaskDraft } from "./types";

const IDENTITY = `You are the ELOSTATE Task Spawn Engine. Your job is to convert either a finalized Decision Dialogue OR a selection of chat messages into a structured task with a clear step-by-step plan.

You operate from these contracts:
1. PRESERVE THE INTENT — the task you produce must match what the source actually decided / discussed. Do not invent new objectives or expand scope beyond what the source supports.
2. READ THE WHOLE CONTEXT — when given selected messages or a single decision proposal, ALSO read the surrounding context to understand who is involved, what already happened, and what constraints exist. The selection is the focus; the surroundings are the reality.
3. STEPS ARE OPERATIONAL — each step is a concrete action a human can complete. Not "consider the implications of X" (that's a question). Not "improve the system" (that's a goal). Specific, actionable, owned by a person where possible.
4. NO INVENTION OF NAMES OR DEADLINES — if the source doesn't name a specific person or date, don't fabricate one. The user will assign + schedule when they review the draft.

You serve the user's judgment. You produce a structured DRAFT; the user reviews and decides whether to save, iterate, or discard.`;

const OUTPUT_RULES = `

OUTPUT FORMAT — strict JSON, no markdown fences, no preamble:

{
  "title": "string (under 100 chars, scannable, captures the goal in one line)",
  "description": "string (1-3 short paragraphs, explains the context + why this task exists in the user's voice as if they were briefing a teammate)",
  "steps": ["string", "string", ... (3-7 concrete steps, each starting with a verb)]
}

STYLE:
- Title: action-oriented. Good: "Ship the auth refactor with the staged rollout plan". Bad: "Auth refactor".
- Description: explains the situation enough for a teammate to act. Do NOT cite ELOSTATE concepts (no "§3.2", no "Pillar 1", no "the Coach"). The teammate doesn't need to know how the task got generated.
- Steps: 3-7 items. Each starts with a verb. No filler. Order matters — first step is what the assignee does first.

WHAT NEVER APPEARS:
- "Consider", "think about", "explore" as the entire step — those are not actions
- Made-up deadlines, made-up names, made-up dollar amounts
- Citations to the source ("as decided in the dialogue", "per Michael's message") in title/steps — those belong in the description if anywhere
- More than 7 steps — if you need more, the task is too big to be one task
`;

const REFINEMENT_RULES = `

REFINEMENT MODE — when previousTaskDraft + adjustmentPrompt are present:

You are NOT starting fresh. The user already has a draft (provided as previousTaskDraft) and is asking you to adjust it (adjustmentPrompt). Treat the previousTaskDraft as the baseline. Apply the adjustment minimally — only change what the prompt asks to change. Preserve the title and unaffected steps.

If the adjustment is unclear or contradicts the original source context, you MAY produce a slightly broader revision, but explain in the description what you changed and why.

If the adjustment asks for something the source genuinely doesn't support (e.g. "add a step for hiring a new engineer" when the source dialogue was about a bug fix), produce the draft anyway but flag the unsupported part in the description so the user can decide whether to keep it.
`;

const CONTEXT_PRESENTATIONS: Record<SpawnContextType, string> = {
  decision:
    "Context type: DECISION. You're being given a finalized Decision Dialogue. The user already went through 4 phases (situation, your read, system response, decide) and chose a path. Your job is to turn the chosen path into a concrete task plan.",
  chat_messages:
    "Context type: CHAT_MESSAGES. An admin has selected specific messages from a chat topic that they want a task generated from. Read the SELECTED messages as the focus, but ALSO read the surrounding conversation to understand the full reality.",
};

export function buildSpawnSystemPrompt(args: {
  contextType: SpawnContextType;
  isRefinement: boolean;
  /**
   * The C.A.R.E user (the support agent). Anchors WHO IS WHO when the input is a scanned external
   * thread whose messages carry no role labels (the extension case) — without it the model guesses
   * sender vs receiver and can mislabel the agent as the customer (founder report 2026-07-24). Parity
   * with the copilot route's Fix-2b anchor. In-app spawn passes real per-message author labels, so
   * this is optional; omit it there.
   */
  agentName?: string;
}): string {
  const anchor =
    args.agentName && args.contextType === "chat_messages"
      ? `\n\nWHO IS WHO (critical): the C.A.R.E user — the support agent — is ${args.agentName}. In the scanned conversation, messages from ${args.agentName} are the AGENT's own words; the OTHER participant is the customer. Attribute sender vs receiver on that basis. Do NOT assume the whole thread is the customer's, and do NOT describe ${args.agentName} as the customer. If the conversation genuinely doesn't make clear which side is the customer, say so in the task description rather than guessing a role.\n`
      : "";
  return [
    IDENTITY,
    anchor,
    `\n\n${CONTEXT_PRESENTATIONS[args.contextType]}\n`,
    args.isRefinement ? REFINEMENT_RULES : "",
    OUTPUT_RULES,
  ].join("");
}

export function buildSpawnUserMessage(args: {
  contextType: SpawnContextType;
  contextPayload: SpawnContextPayload;
  previousTaskDraft?: SpawnedTaskDraft;
  adjustmentPrompt?: string;
}): string {
  const sections: string[] = [];

  if (args.contextType === "decision") {
    const p = args.contextPayload;
    sections.push("FINALIZED DECISION DIALOGUE:");
    if (p.decisionSituation) sections.push(`Situation:\n${p.decisionSituation}`);
    if (p.decisionDiagnosis)
      sections.push(`User's read on what's going on:\n${p.decisionDiagnosis}`);
    if (p.decisionProposal)
      sections.push(`User's proposed action:\n${p.decisionProposal}`);
    if (p.decisionSystemResponse) {
      sections.push(
        `System's response:\n${JSON.stringify(p.decisionSystemResponse, null, 2)}`
      );
    }
    if (p.decisionChosenPath) {
      sections.push(
        `Chosen path: ${p.decisionChosenPath}${
          p.decisionChosenNote ? ` (note: ${p.decisionChosenNote})` : ""
        }`
      );
    }
  } else {
    const p = args.contextPayload;
    sections.push("CHAT TOPIC:");
    if (p.chatTopicTitle) sections.push(`Title: ${p.chatTopicTitle}`);
    if (p.chatTopicDescription) sections.push(`Description: ${p.chatTopicDescription}`);
    if (p.selectedMessages?.length) {
      sections.push(
        `SELECTED MESSAGES (the focus):\n${p.selectedMessages
          .map((m) => `  ${m.author}: ${m.body}`)
          .join("\n")}`
      );
    }
    if (p.surroundingThread?.length) {
      sections.push(
        `SURROUNDING CONVERSATION (context):\n${p.surroundingThread
          .map((m) => `  ${m.author}: ${m.body}`)
          .join("\n")}`
      );
    }
  }

  if (args.previousTaskDraft) {
    sections.push(
      `\nPREVIOUS DRAFT (revise this, don't start fresh):\n${JSON.stringify(args.previousTaskDraft, null, 2)}`
    );
  }
  if (args.adjustmentPrompt) {
    sections.push(`\nUSER'S ADJUSTMENT REQUEST:\n${args.adjustmentPrompt}`);
  }

  return sections.join("\n\n");
}
