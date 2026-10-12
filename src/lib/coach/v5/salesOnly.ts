/**
 * Is this session a SALES CALL? The one verdict (CLAUDE.md §2.2) for "may the sales-call coaching run here".
 *
 * WHY (2026-10-09). The sales engines (summary, moments, pivot, intel, dissect, the after-pitch read and its points)
 * ran on meetings and huddles too: production had 6 sales after-pitch summaries on them, repeated engine runs (latest
 * 2026-10-07) and 54 leaderboard points banked for a huddle on 2026-09-04, graded on opener / close / objection.
 * Meetings have their own review (meeting-session/[id]/dissect). Founder picker 2026-10-09: "Sales coaching on
 * sales calls only". Pitch scoring already refused them (scoreSession not_a_sales_call).
 *
 * Consumers: generateSessionArtifacts, generateAndStoreAfterPitch, the on-demand engine routes, the review backfill
 * and the "whose voice" route. INVARIANT 34 (scripts/invariant-audit.mjs) fails a sales-session route that runs an
 * engine without asking.
 */
export function isSalesCall(sessionKind: string | null | undefined): boolean {
  return sessionKind === "sales";
}

/** What a sales-only route answers for a meeting or huddle. */
export const NOT_A_SALES_CALL = {
  status: "not-a-sales-call",
  error: "This is a sales-call feature. Meetings and huddles have their own review.",
} as const;
