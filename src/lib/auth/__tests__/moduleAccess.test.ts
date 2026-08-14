import { describe, expect, it } from "vitest";
import {
  moduleForPath,
  moduleHome,
  isPathAllowed,
  redirectForLock,
  lockFromPilotModule,
  moduleGateDecision,
} from "../moduleAccess";

describe("moduleForPath", () => {
  it("maps the sales-coach root + subtree", () => {
    expect(moduleForPath("/dashboard/sales-coach")).toBe("sales_coach");
    expect(moduleForPath("/dashboard/sales-coach/kpi")).toBe("sales_coach");
    expect(moduleForPath("/dashboard/sales-coach/abc/def")).toBe("sales_coach");
  });
  it("maps the care root + subtree", () => {
    expect(moduleForPath("/dashboard/care")).toBe("care");
    expect(moduleForPath("/dashboard/care/conversations")).toBe("care");
  });
  it("treats the hub + any other route as elostate", () => {
    expect(moduleForPath("/dashboard")).toBe("elostate");
    expect(moduleForPath("/dashboard/settings")).toBe("elostate");
    expect(moduleForPath("/dashboard/finance")).toBe("elostate");
  });
  it("does NOT mistake a lookalike prefix for the module subtree", () => {
    // /dashboard/sales-coach-x is a different route, not the sales-coach subtree.
    expect(moduleForPath("/dashboard/sales-coach-x")).toBe("elostate");
    expect(moduleForPath("/dashboard/care-team")).toBe("elostate");
  });
});

describe("isPathAllowed", () => {
  it("no lock (complete/legacy) → everything allowed", () => {
    expect(isPathAllowed(null, "/dashboard")).toBe(true);
    expect(isPathAllowed(null, "/dashboard/sales-coach")).toBe(true);
    expect(isPathAllowed(null, "/dashboard/care")).toBe(true);
  });
  it("sales_coach lock → only the sales-coach subtree", () => {
    expect(isPathAllowed("sales_coach", "/dashboard/sales-coach")).toBe(true);
    expect(isPathAllowed("sales_coach", "/dashboard/sales-coach/kpi")).toBe(true);
    expect(isPathAllowed("sales_coach", "/dashboard")).toBe(false);
    expect(isPathAllowed("sales_coach", "/dashboard/care")).toBe(false);
    expect(isPathAllowed("sales_coach", "/dashboard/finance")).toBe(false);
  });
  it("care lock → only the care subtree", () => {
    expect(isPathAllowed("care", "/dashboard/care")).toBe(true);
    expect(isPathAllowed("care", "/dashboard/care/growth")).toBe(true);
    expect(isPathAllowed("care", "/dashboard/sales-coach")).toBe(false);
    expect(isPathAllowed("care", "/dashboard")).toBe(false);
  });
});

describe("redirectForLock", () => {
  it("no lock → never redirect", () => {
    expect(redirectForLock(null, "/dashboard/sales-coach")).toBeNull();
    expect(redirectForLock(null, "/dashboard")).toBeNull();
  });
  it("locked account straying → redirect to its module home", () => {
    expect(redirectForLock("sales_coach", "/dashboard")).toBe("/dashboard/sales-coach");
    expect(redirectForLock("sales_coach", "/dashboard/care")).toBe("/dashboard/sales-coach");
    expect(redirectForLock("care", "/dashboard/sales-coach/kpi")).toBe("/dashboard/care");
  });
  it("locked account ON an allowed path → no redirect", () => {
    expect(redirectForLock("sales_coach", "/dashboard/sales-coach/kpi")).toBeNull();
    expect(redirectForLock("care", "/dashboard/care")).toBeNull();
  });
  it("never redirects the module home to itself (no loop)", () => {
    expect(redirectForLock("sales_coach", "/dashboard/sales-coach")).toBeNull();
    expect(redirectForLock("care", "/dashboard/care")).toBeNull();
  });
});

describe("moduleHome + lockFromPilotModule", () => {
  it("moduleHome maps each lock", () => {
    expect(moduleHome("sales_coach")).toBe("/dashboard/sales-coach");
    expect(moduleHome("care")).toBe("/dashboard/care");
  });
  it("lockFromPilotModule: care/sales_coach lock; elostate + unknown → null", () => {
    expect(lockFromPilotModule("care")).toBe("care");
    expect(lockFromPilotModule("sales_coach")).toBe("sales_coach");
    expect(lockFromPilotModule("elostate")).toBeNull();
    expect(lockFromPilotModule(null)).toBeNull();
    expect(lockFromPilotModule("whatever")).toBeNull();
  });
});

describe("moduleGateDecision", () => {
  it("a member always enters (locked or not)", () => {
    expect(moduleGateDecision(true, true)).toBe("enter");
    expect(moduleGateDecision(true, false)).toBe("enter");
  });

  it("REGRESSION: a LOCKED non-member HOLDS, never redirects to the hub", () => {
    // This is the redirect-loop fix. A locked non-member sent to /dashboard is bounced back into the module by
    // the middleware lock → ERR_TOO_MANY_REDIRECTS, bricking a freshly-invited rep. It MUST hold in-module.
    expect(moduleGateDecision(false, true)).toBe("hold");
  });

  it("a non-locked non-member is sent to the hub (no lock, no loop)", () => {
    expect(moduleGateDecision(false, false)).toBe("hub");
  });
});
