/**
 * Inbox auto-advance decision for a single assign/unassign (closure findings 17-18, 2026-07-27).
 *
 * When an agent assigns a conversation away, the AMD-006 continuity rule says: if that action moves the
 * conversation OUT of the current filtered view, advance to the neighbor so the agent isn't stranded on a
 * conversation that just left their list — exactly like a terminal close/resolve does. But assignment,
 * unlike close/resolve, does NOT always leave the view: it only changes membership of two views —
 *   • "mine"       — a conversation leaves when it's assigned AWAY from the current user (target ≠ me).
 *   • "unassigned" — a conversation leaves when it becomes assigned to anyone (target ≠ null).
 * Every other view (all_open, snoozed, resolved, closed, needs_guidance) is assignment-invariant, so the
 * conversation stays and the agent must NOT be advanced (a jump while the item is still visible is a bug).
 *
 * This is a PURE predicate deliberately extracted from ConversationsApp so its edge cases are locked by a
 * test and can't silently regress. It is computed at ACTION time (from view + target + current user), NOT by
 * reading the post-action `filtered` list — whose useMemo hasn't re-derived from the reload yet (the
 * stale-state trap). Matches the house pattern of routeGuard / evaluateControlGate / isExtensionHandoffAllowed.
 *
 * Locked by `inboxAdvance.test.ts`.
 */
export function assignWillLeaveView(args: {
  /** The active inbox view/filter key. */
  view: string;
  /** The assignment target: an agent id, or null to unassign (return to the pool). */
  targetAgentId: string | null;
  /** The current (acting) user's id. */
  currentUserId: string | null;
}): boolean {
  const { view, targetAgentId, currentUserId } = args;
  // Mine: leaves when assigned away from me (to someone else, or unassigned).
  if (view === "mine") return targetAgentId !== currentUserId;
  // Unassigned: leaves when it becomes assigned to anyone.
  if (view === "unassigned") return targetAgentId !== null;
  // Every other view is assignment-invariant — the conversation stays visible, so do not advance.
  return false;
}
