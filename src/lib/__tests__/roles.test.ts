import { describe, it, expect } from "vitest";
import {
  ADMIN_ROLES,
  INVITABLE_ROLES,
  isAdminRole,
  isInvitableRole,
  orgRoleRank,
  orgTierLabel,
  byOrgRank,
  ORG_TIERS,
} from "@/lib/roles";

// Audit 2026-07-10 F4: single-source role vocabulary. These tests are the
// behavior-preservation guarantee for the gates migrated from the inline
// `role === 'CEO' || 'COO' || 'admin'` to isAdminRole() — the admit/deny set
// MUST be identical, or the migration silently changed an authz gate.
describe("roles — admin gate (behavior preservation)", () => {
  it("admits exactly CEO / COO / admin — same set the inline gates used", () => {
    // The exact set the ~20 inline gates checked. If this changes, every
    // migrated gate's behavior changed with it.
    expect([...ADMIN_ROLES].sort()).toEqual(["COO", "CEO", "admin"].sort());
  });

  it("isAdminRole matches the old inline predicate for every relevant value", () => {
    const inline = (r: string | null | undefined) =>
      r === "CEO" || r === "COO" || r === "admin";
    for (const r of ["CEO", "COO", "admin", "Lead", "Member", "member", "", null, undefined, "administrator", "ADMIN"]) {
      expect(isAdminRole(r)).toBe(inline(r));
    }
  });

  it("does NOT admit Lead / Member / lowercase member (non-admin roles)", () => {
    expect(isAdminRole("Lead")).toBe(false);
    expect(isAdminRole("Member")).toBe(false);
    expect(isAdminRole("member")).toBe(false);
  });

  it("null/undefined/empty are not admin", () => {
    expect(isAdminRole(null)).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
    expect(isAdminRole("")).toBe(false);
  });
});

describe("roles — invitable set", () => {
  it("is exactly the 0008 CHECK set CEO/COO/Lead/Member", () => {
    expect([...INVITABLE_ROLES]).toEqual(["CEO", "COO", "Lead", "Member"]);
  });

  it("isInvitableRole rejects the onboarding 'admin' role (not invitable) + junk", () => {
    expect(isInvitableRole("CEO")).toBe(true);
    expect(isInvitableRole("Member")).toBe(true);
    expect(isInvitableRole("admin")).toBe(false); // onboarding-only, not invitable
    expect(isInvitableRole("member")).toBe(false); // wrong case
    expect(isInvitableRole(null)).toBe(false);
    expect(isInvitableRole(42)).toBe(false);
  });
});

describe("roles — org hierarchy (top-to-bottom display order)", () => {
  it("ranks the six tiers in order: C-Suite < VP < Director < Manager < Supervisor < Frontline", () => {
    expect(orgRoleRank("CEO")).toBe(0);
    expect(orgRoleRank("VP")).toBe(1);
    expect(orgRoleRank("Director")).toBe(2);
    expect(orgRoleRank("Manager")).toBe(3);
    expect(orgRoleRank("Supervisor")).toBe(4);
    expect(orgRoleRank("Member")).toBe(5);
    // strictly increasing down the org
    const ranks = ["CEO", "VP", "Director", "Manager", "Supervisor", "Member"].map(orgRoleRank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(new Set(ranks).size).toBe(6);
  });

  it("groups the existing role vocabulary into the right tiers", () => {
    // C-Suite covers the onboarding 'admin' + CEO/CFO/COO
    for (const r of ["admin", "CEO", "CFO", "COO"]) expect(orgRoleRank(r)).toBe(0);
    // the invitable 'Lead' is a Supervisor / Team Lead
    expect(orgRoleRank("Lead")).toBe(4);
    // 'Member' and the sales-coach 'staff' are Frontline
    expect(orgRoleRank("Member")).toBe(5);
    expect(orgRoleRank("staff")).toBe(5);
  });

  it("is case-insensitive (the 'Member'/'member' casing split ranks identically)", () => {
    expect(orgRoleRank("member")).toBe(orgRoleRank("Member"));
    expect(orgRoleRank("ADMIN")).toBe(0);
    expect(orgRoleRank(" ceo ")).toBe(0); // trims too
  });

  it("sinks an unknown or null role to the bottom (below Frontline), never above it", () => {
    expect(orgRoleRank(null)).toBe(ORG_TIERS.length);
    expect(orgRoleRank(undefined)).toBe(ORG_TIERS.length);
    expect(orgRoleRank("wizard")).toBe(ORG_TIERS.length);
    expect(orgRoleRank("wizard")).toBeGreaterThan(orgRoleRank("Member"));
  });

  it("orgTierLabel names the tier, 'Unassigned' for unknown", () => {
    expect(orgTierLabel("CEO")).toBe("C-Suite");
    expect(orgTierLabel("Lead")).toBe("Supervisor / Team Lead");
    expect(orgTierLabel("Member")).toBe("Frontline");
    expect(orgTierLabel(null)).toBe("Unassigned");
  });

  it("byOrgRank sorts top-to-bottom by tier, then A→Z by name within a tier", () => {
    const team = [
      { role: "Member", name: "Zed" },
      { role: "CEO", name: "Bob" },
      { role: "Member", name: "Alice" },
      { role: "Director", name: "Dana" },
      { role: null, name: "Nobody" }, // unassigned → bottom
      { role: "CEO", name: "Ada" },
    ];
    const sorted = [...team].sort(byOrgRank((m) => m.role, (m) => m.name)).map((m) => m.name);
    expect(sorted).toEqual(["Ada", "Bob", "Dana", "Alice", "Zed", "Nobody"]);
  });
});
