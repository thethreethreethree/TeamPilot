/**
 * The battlecard's instruction (Engage plan E14; Gong F13.11), asked of the calls that named a competitor through Ask
 * Coach, whose system prompt already requires every point to cite a line and forbids guessing. Here so the route file
 * exports only its handler.
 */
export const BATTLECARD_INSTRUCTION = (competitor: string) =>
  `Write a short battlecard about the competitor "${competitor}" from these calls, for a sales rep. Four headed parts: ` +
  `"What customers say about ${competitor}" (what they like, what they don't), "Objections we hear", "What we answered that worked", ` +
  `"Questions to ask". Bullet points, each citing the line it rests on. Only what the calls show: leave a part out rather than guess, ` +
  `and never state a price, feature or fact about ${competitor} that no one said on these calls.`;
