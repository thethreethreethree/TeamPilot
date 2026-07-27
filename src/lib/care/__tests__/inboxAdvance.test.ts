import { describe, it, expect } from "vitest";
import { assignWillLeaveView } from "../inboxAdvance";

/**
 * Locks the single assign/unassign auto-advance predicate (closure findings 17-18). A regression here either
 * strands the agent on a conversation that just left their view, or jumps them off one that's still visible —
 * both break the AMD-006 continuity the founder asked for. The subtle cases are the assign-to-self and
 * unassign variants, and the assignment-invariant views.
 */
const ME = "agent-me";
const OTHER = "agent-other";

describe("assignWillLeaveView — advance iff the assignment moves the conversation out of the view", () => {
  describe('view "mine" (assigned to me): leaves when assigned AWAY from me', () => {
    it("assign to someone else → leaves (advance)", () => {
      expect(assignWillLeaveView({ view: "mine", targetAgentId: OTHER, currentUserId: ME })).toBe(true);
    });
    it("unassign (→ pool) → leaves (advance)", () => {
      expect(assignWillLeaveView({ view: "mine", targetAgentId: null, currentUserId: ME })).toBe(true);
    });
    it("assign to self (no-op on membership) → stays (do NOT advance)", () => {
      expect(assignWillLeaveView({ view: "mine", targetAgentId: ME, currentUserId: ME })).toBe(false);
    });
  });

  describe('view "unassigned": leaves when it becomes assigned to anyone', () => {
    it("assign to someone → leaves (advance)", () => {
      expect(assignWillLeaveView({ view: "unassigned", targetAgentId: OTHER, currentUserId: ME })).toBe(true);
    });
    it("claim to self → leaves (advance)", () => {
      expect(assignWillLeaveView({ view: "unassigned", targetAgentId: ME, currentUserId: ME })).toBe(true);
    });
    it("unassign (already unassigned, stays) → do NOT advance", () => {
      expect(assignWillLeaveView({ view: "unassigned", targetAgentId: null, currentUserId: ME })).toBe(false);
    });
  });

  describe("assignment-invariant views: never advance (the conversation stays visible)", () => {
    for (const view of ["all_open", "snoozed", "resolved", "closed", "needs_guidance"]) {
      it(`${view}: assign away → stays`, () => {
        expect(assignWillLeaveView({ view, targetAgentId: OTHER, currentUserId: ME })).toBe(false);
      });
      it(`${view}: unassign → stays`, () => {
        expect(assignWillLeaveView({ view, targetAgentId: null, currentUserId: ME })).toBe(false);
      });
    }
  });
});
