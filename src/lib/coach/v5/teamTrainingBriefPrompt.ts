import "server-only";

/**
 * Coach v5.0 — Team Training Brief prompt (founder 2026-08-26, "team feedback engine first" slice).
 *
 * Feeds the manager a TEAM-level training brief built from the last period's coaching signal: the recurring growth
 * areas + strategy gaps pooled ACROSS the team's own Dissects, plus the team's door-activity context. The manager
 * runs it in the next team meeting. It teaches the TEAM's pattern, never ranks reps (§A18 — the per-rep line is a
 * one-line coaching FOCUS, not a scoreboard). §3.4: the engine refuses to call the LLM below a signal threshold, so
 * the brief is never fabricated from nothing.
 */

export type TeamTrainingBriefInput = {
  periodLabel: string; // e.g. "the last 7 days"
  repCount: number;
  dissectCount: number;
  // Pooled across the team's recent Dissects (deduped, most-common first).
  growthAreas: string[];
  strategies: string[];
  strengths: string[];
  // Team door activity for context (objective results, not a ranking).
  door: { doorsKnocked: number; presentations: number; sold: number };
};

export type TeamTrainingBrief = {
  // 2–3 team-wide patterns worth a group training, each with WHY it matters (from the pooled signal).
  themes: { title: string; why: string }[];
  // One concrete drill the manager can run in the meeting tomorrow.
  drill: { title: string; steps: string[] };
  // A one-line coaching FOCUS per rep who has signal (NOT a grade, NOT ranked).
  repFocus: { rep: string; focus: string }[];
  periodLabel: string;
};

export function buildTeamBriefSystemPrompt(): string {
  return [
    "You are a sales team's coaching lead preparing a SHORT training brief the manager will run in tomorrow's team meeting.",
    "You are given the team's own recent coaching signal (recurring growth areas + strategy gaps pooled across the team's",
    "call Dissects) and the team's door activity. Produce a brief that teaches the TEAM's shared pattern.",
    "",
    "RULES:",
    "- Coach the PATTERN, not the person. The team themes must come from the pooled growth areas / strategy gaps you were given — never invent a weakness the data doesn't show.",
    "- The drill must be concrete and runnable in ~10-15 minutes by a manager with no prep (name it; give 3-5 numbered steps; tie it to a theme).",
    "- repFocus is ONE short coaching focus per named rep — a direction to grow, never a grade, ranking, or criticism. Only include reps present in the input.",
    "- Be specific and practical. No filler, no praise padding. If a field has thin signal, keep it short rather than padding it.",
    "- Do NOT use em dashes or en dashes; write plainly.",
    "",
    "Return STRICT JSON in this exact shape, and nothing else:",
    '{"themes":[{"title":"...","why":"..."}],"drill":{"title":"...","steps":["...","..."]},"repFocus":[{"rep":"Name","focus":"..."}]}',
  ].join("\n");
}

export function buildTeamBriefUserMessage(input: TeamTrainingBriefInput): string {
  const list = (xs: string[]) => (xs.length ? xs.map((x) => `- ${x}`).join("\n") : "- (none recorded)");
  return [
    `PERIOD: ${input.periodLabel}. Team of ${input.repCount} reps, ${input.dissectCount} coached calls in the window.`,
    "",
    "RECURRING GROWTH AREAS across the team (most common first):",
    list(input.growthAreas),
    "",
    "STRATEGY GAPS / moves the team is missing:",
    list(input.strategies),
    "",
    "TEAM STRENGTHS to build on:",
    list(input.strengths),
    "",
    `DOOR ACTIVITY (context): ${input.door.doorsKnocked} knocked, ${input.door.presentations} presentations, ${input.door.sold} sold.`,
    "",
    "Write the team training brief now.",
  ].join("\n");
}
