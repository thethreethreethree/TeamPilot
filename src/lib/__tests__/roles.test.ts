import { describe, it, expect } from "vitest";
import {
  ADMIN_ROLES,
  INVITABLE_ROLES,
  isAdminRole,
  isInvitableRole,
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
