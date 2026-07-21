/**
 * C.A.R.E handover — the customer-facing notice (founder 2026-07-21, requirement #1:
 * "the customer needs to be aware that the conversation will be handed over to a
 * Customer Support Agent"). Posted as a system message (postSystemMessage) at BOTH
 * handoff paths — when Jeff escalates AND when an agent claims the conversation — so
 * the customer always sees the same clear, warm notice regardless of which side
 * initiated. One exported const so the two call sites can never drift.
 *
 * Pure string, no imports — safe to reference from the data layer and the route.
 */
export const HANDOFF_NOTICE =
  "You're being connected with a member of our support team. They'll pick up right here and have everything you've shared so far.";
