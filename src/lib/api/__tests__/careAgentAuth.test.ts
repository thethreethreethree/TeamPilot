import { describe, expect, it } from "vitest";
import { deriveCareAccess } from "../careAgentAuth";

/**
 * The C.A.R.E access matrix (who may enter the support console). This is the
 * single-source-of-truth gate; pinning it so a change to the role set or the
 * agent-OR-admin rule is a conscious, test-caught one. isAdmin = leadership role;
 * isAgent (the actual gate — a non-agent is 403'd) = support agent OR admin.
 */
describe("deriveCareAccess", () => {
  it("leadership roles are admin AND agent", () => {
    for (const role of ["CEO", "COO", "admin"]) {
      expect(deriveCareAccess({ role, isSupportAgent: false })).toEqual({
        isAdmin: true,
        isAgent: true,
      });
    }
  });

  it("a designated support agent (non-leadership) is agent but not admin", () => {
    expect(deriveCareAccess({ role: "Member", isSupportAgent: true })).toEqual({
      isAdmin: false,
      isAgent: true,
    });
  });

  it("a plain member with no agent flag is neither (denied)", () => {
    expect(deriveCareAccess({ role: "Member", isSupportAgent: false })).toEqual({
      isAdmin: false,
      isAgent: false,
    });
  });

  it("admin implies agent even without the support flag", () => {
    expect(deriveCareAccess({ role: "admin", isSupportAgent: false }).isAgent).toBe(true);
  });

  it("null/absent role + no flag is denied; null role + flag is an agent", () => {
    expect(deriveCareAccess({ role: null, isSupportAgent: false })).toEqual({
      isAdmin: false,
      isAgent: false,
    });
    expect(deriveCareAccess({ role: null, isSupportAgent: null })).toEqual({
      isAdmin: false,
      isAgent: false,
    });
    expect(deriveCareAccess({ role: null, isSupportAgent: true })).toEqual({
      isAdmin: false,
      isAgent: true,
    });
  });

  it("a non-leadership role string is not admin (no accidental broadening)", () => {
    expect(deriveCareAccess({ role: "Lead", isSupportAgent: false }).isAdmin).toBe(false);
    expect(deriveCareAccess({ role: "administrator", isSupportAgent: false }).isAdmin).toBe(false);
  });
});
