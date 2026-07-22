import { describe, it, expect } from "vitest";
import {
  computeExtensionEntitlement,
  EXTENSION_TRIAL_DAYS,
} from "@/lib/care/extensionEntitlement";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-07-22T00:00:00Z");

/**
 * Entitlement decision for the C.A.R.E extension (spec D2): pro/enterprise = active; an unexpired trial
 * = trial; otherwise locked. §3.4 — an expired trial reads locked, never a silent grant.
 */
describe("computeExtensionEntitlement (D2)", () => {
  it("pro plan → active (no trial needed)", () => {
    expect(computeExtensionEntitlement({ plan: "pro", trialStartedAt: null, now: NOW }).status).toBe("active");
  });

  it("enterprise plan → active", () => {
    expect(computeExtensionEntitlement({ plan: "enterprise", trialStartedAt: null, now: NOW }).status).toBe("active");
  });

  it("pilot/starter with no trial → locked", () => {
    expect(computeExtensionEntitlement({ plan: "pilot", trialStartedAt: null, now: NOW }).status).toBe("locked");
    expect(computeExtensionEntitlement({ plan: "starter", trialStartedAt: null, now: NOW }).status).toBe("locked");
  });

  it("trial started today → trial, full window remaining", () => {
    const r = computeExtensionEntitlement({
      plan: "pilot",
      trialStartedAt: new Date(NOW).toISOString(),
      now: NOW,
    });
    expect(r.status).toBe("trial");
    expect(r.trialDaysLeft).toBe(EXTENSION_TRIAL_DAYS);
  });

  it("trial mid-window → trial with correct days left", () => {
    const startedAt = new Date(NOW - 4 * DAY).toISOString();
    const r = computeExtensionEntitlement({ plan: "pilot", trialStartedAt: startedAt, now: NOW });
    expect(r.status).toBe("trial");
    expect(r.trialDaysLeft).toBe(EXTENSION_TRIAL_DAYS - 4);
  });

  it("EXPIRED trial → locked (no silent grant)", () => {
    const startedAt = new Date(NOW - (EXTENSION_TRIAL_DAYS + 1) * DAY).toISOString();
    expect(computeExtensionEntitlement({ plan: "pilot", trialStartedAt: startedAt, now: NOW }).status).toBe("locked");
  });

  it("trial exactly at the boundary → locked (window is exclusive at the end)", () => {
    const startedAt = new Date(NOW - EXTENSION_TRIAL_DAYS * DAY).toISOString();
    expect(computeExtensionEntitlement({ plan: "pilot", trialStartedAt: startedAt, now: NOW }).status).toBe("locked");
  });

  it("a future/garbled trial start does not grant access", () => {
    expect(computeExtensionEntitlement({ plan: "pilot", trialStartedAt: new Date(NOW + DAY).toISOString(), now: NOW }).status).toBe("locked");
    expect(computeExtensionEntitlement({ plan: "pilot", trialStartedAt: "not-a-date", now: NOW }).status).toBe("locked");
  });

  it("defaults a null plan to pilot (locked without trial)", () => {
    expect(computeExtensionEntitlement({ plan: null, trialStartedAt: null, now: NOW }).status).toBe("locked");
  });
});
