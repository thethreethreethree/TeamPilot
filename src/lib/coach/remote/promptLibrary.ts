/**
 * Ask Coach prompt library (2026-11-23; gong.io capture M36 "AI prompt library", graded LACK). Ready-made questions
 * for the two Ask boxes — one call, and the whole pipeline — written for ELOSTATE's own data (our wording, not
 * Gong's). Picking one FILLS the box; the person edits it and presses Ask themselves (§3.3: they stay the author of
 * the question). Every prompt asks only for what the data behind that box holds: a call's transcript, its score and
 * coaching notes; or the pipeline's stages, amounts, next calls, to-dos, risk and latest call summaries.
 */
export type PromptScope = "call" | "pipeline";
export type LibraryPrompt = { id: string; group: string; title: string; text: string };

const CALL: LibraryPrompt[] = [
  { id: "c-coach", group: "Coach me", title: "What to keep and what to change", text: "Coach me on this call: two things I did well, the one moment that cost me most, and what I should say next time instead. Quote the lines." },
  { id: "c-practice", group: "Coach me", title: "One skill to practice", text: "From this call, pick the single skill that would most change my results and give me a short exercise to practice it before my next call." },
  { id: "c-objection", group: "Coach me", title: "Objections, handled or not", text: "List every objection the customer raised, quote it, and say whether I answered the real concern or talked past it. Suggest a better reply for the weakest one." },
  { id: "c-questions", group: "Coach me", title: "Questions I didn't ask", text: "What did I fail to find out on this call that I needed to know? Give me the questions I should have asked, in the order I should ask them next time." },
  { id: "c-signals", group: "Read the buyer", title: "Buying signals", text: "What did the customer say that shows real intent, urgency, budget or timing? Quote each line, say who said it, and rate how strong it is." },
  { id: "c-decider", group: "Read the buyer", title: "Who decides", text: "Based only on what was said, who makes the decision and who else is involved? If it wasn't said, tell me it's unknown and what to ask." },
  { id: "c-competitor", group: "Read the buyer", title: "Other options they mentioned", text: "Did the customer mention another provider, a current solution or doing nothing? Quote it and tell me how I responded." },
  { id: "c-commitments", group: "After the call", title: "Who promised what", text: "List every commitment made on this call — by me or the customer — with who owns it and any date mentioned. Don't add anything that wasn't said." },
  { id: "c-followup", group: "After the call", title: "Draft my follow-up", text: "Write a short follow-up message to the customer from this call: what we agreed, the next step and the date. Only include what was actually said." },
  { id: "c-summary", group: "After the call", title: "Summary for my manager", text: "Summarize this call for my manager in five lines: where the deal stands, the main risk, what the customer wants, and the agreed next step." },
  { id: "c-close", group: "After the call", title: "Raise the chance of closing", text: "What are the three things I should do before the next call to make this deal more likely to close, and why each one matters?" },
];

const PIPELINE: LibraryPrompt[] = [
  { id: "p-risk", group: "This week", title: "Deals at risk", text: "Which deals are at risk of slipping, why, and what is the one thing to do on each this week? Start with the biggest." },
  { id: "p-first", group: "This week", title: "What to do first", text: "Looking at my whole pipeline, what should I do first this week and in what order? Keep it to five actions." },
  { id: "p-nocall", group: "This week", title: "No next call booked", text: "Which open prospects have no next call booked or a booked date that already passed? Suggest how to re-open each one." },
  { id: "p-todos", group: "This week", title: "Overdue to-dos", text: "Which prospects have overdue to-dos, and which of those deals is most at risk because of it?" },
  { id: "p-stall", group: "Patterns", title: "Why deals stall", text: "Where in the pipeline do deals stall, and what do the stalled deals have in common? Use their stages, last calls and what was said." },
  { id: "p-wins", group: "Patterns", title: "What the won deals share", text: "What do the closed-won deals have in common compared with the closed-lost ones — stage, source, amount, or what was said on their last calls?" },
  { id: "p-sources", group: "Patterns", title: "Best lead sources", text: "Which lead sources bring deals that move and close, and which bring deals that stall? Say where the numbers are too small to judge." },
  { id: "p-exec", group: "Report", title: "Pipeline summary for leadership", text: "Summarize this pipeline for leadership in three headlines — health, biggest risk, best opportunity — each backed by the deals behind it." },
  { id: "p-biggest", group: "Report", title: "The deals that matter most", text: "Which five deals matter most by amount and readiness, where does each stand, and what is its next step?" },
];

export const PROMPT_LIBRARY: Record<PromptScope, LibraryPrompt[]> = { call: CALL, pipeline: PIPELINE };

/** The library for one box, grouped in order of first appearance. */
export function promptGroups(scope: PromptScope): Array<{ group: string; prompts: LibraryPrompt[] }> {
  const out: Array<{ group: string; prompts: LibraryPrompt[] }> = [];
  for (const p of PROMPT_LIBRARY[scope]) {
    const g = out.find((x) => x.group === p.group);
    if (g) g.prompts.push(p);
    else out.push({ group: p.group, prompts: [p] });
  }
  return out;
}
