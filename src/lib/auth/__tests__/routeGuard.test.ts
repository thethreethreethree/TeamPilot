import { describe, it, expect } from "vitest";
import { decideAuthRedirect } from "../routeGuard";

/**
 * Locks the route-protection invariants of the request middleware (the auth
 * gate). A regression here means either unauthenticated users reach protected
 * routes, or authenticated users get bounced to a login form — both are
 * security/UX breaks. These tests also guard the pending middleware→proxy
 * migration (FOUNDER-ACTION-QUEUE 8f): after the rename, the gate must still
 * fire exactly as below.
 */
describe("decideAuthRedirect — auth gate", () => {
  describe("unauthenticated users hitting protected routes → login", () => {
    it("sends /dashboard to /login", () => {
      expect(decideAuthRedirect({ hasUser: false, path: "/dashboard" })).toBe("/login");
    });

    it("sends a nested /dashboard/... route to /login", () => {
      expect(decideAuthRedirect({ hasUser: false, path: "/dashboard/care/inbox" })).toBe(
        "/login"
      );
    });

    it("sends /onboarding to /login", () => {
      expect(decideAuthRedirect({ hasUser: false, path: "/onboarding" })).toBe("/login");
    });

    it("sends nested /onboarding/... to /login", () => {
      expect(decideAuthRedirect({ hasUser: false, path: "/onboarding/step-2" })).toBe(
        "/login"
      );
    });

    it("bounces Sales-Coach deep-links to the BRANDED login, not /login", () => {
      expect(
        decideAuthRedirect({ hasUser: false, path: "/dashboard/sales-coach" })
      ).toBe("/sales-coach/login");
      expect(
        decideAuthRedirect({ hasUser: false, path: "/dashboard/sales-coach/session/42" })
      ).toBe("/sales-coach/login");
    });
  });

  describe("authenticated users hitting login pages → into the app", () => {
    it("sends /login to /dashboard", () => {
      expect(decideAuthRedirect({ hasUser: true, path: "/login" })).toBe("/dashboard");
    });

    it("sends /sales-coach/login to /dashboard/sales-coach", () => {
      expect(decideAuthRedirect({ hasUser: true, path: "/sales-coach/login" })).toBe(
        "/dashboard/sales-coach"
      );
    });
  });

  describe("no redirect (proceed) cases", () => {
    it("lets an authenticated user into /dashboard", () => {
      expect(decideAuthRedirect({ hasUser: true, path: "/dashboard" })).toBeNull();
    });

    it("lets an authenticated user into /dashboard/sales-coach", () => {
      expect(
        decideAuthRedirect({ hasUser: true, path: "/dashboard/sales-coach" })
      ).toBeNull();
    });

    it("lets an authenticated user into /onboarding", () => {
      expect(decideAuthRedirect({ hasUser: true, path: "/onboarding" })).toBeNull();
    });

    it("does NOT bounce an unauthenticated user sitting on /login (would loop)", () => {
      expect(decideAuthRedirect({ hasUser: false, path: "/login" })).toBeNull();
    });

    it("does NOT bounce an unauthenticated user on the branded login page", () => {
      expect(decideAuthRedirect({ hasUser: false, path: "/sales-coach/login" })).toBeNull();
    });
  });

  describe("ordering: protected-check precedes the login-page checks", () => {
    it("an unauthenticated user is redirected out of /dashboard/sales-coach BEFORE any login-page rule", () => {
      // /dashboard/sales-coach is protected AND contains 'sales-coach'; the
      // protected branch must win and route to the branded login.
      expect(
        decideAuthRedirect({ hasUser: false, path: "/dashboard/sales-coach" })
      ).toBe("/sales-coach/login");
    });
  });
});
