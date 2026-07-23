import { describe, it, expect } from "vitest";
import { toWidgetSafeConfig, type CareTenantConfig } from "../config";

/**
 * Locks the PUBLIC widget bootstrap non-exposure property: `toWidgetSafeConfig` must return ONLY the
 * eight widget-displayable fields and never any internal one. `/api/care/widget/bootstrap` is
 * unauthenticated, so a regression here (e.g. someone swapping the whitelist for a `...spread`) would
 * leak internal tenant config — allowedOrigins, plan, quota, and especially aiProductContext (the
 * tenant's internal product playbook fed to the AI system prompt) — to any caller with the public token.
 */

// A fully-populated config with DISTINCT sentinel values on every internal field, so a leak is visible.
const FULL: CareTenantConfig = {
  companyId: "SECRET-company-id",
  allowedOrigins: ["https://SECRET-origin.example"],
  active: true,
  widgetColor: "#FACC15",
  widgetGreeting: "We're here to help",
  widgetSubtitle: "Ask us anything",
  widgetPosition: "bottom-right",
  widgetLogoUrl: "https://cdn.example/logo.png",
  companyDisplayName: "Acme Co",
  replySignature: "SECRET-signature",
  aiProductContext: "SECRET-internal-product-playbook",
  aiTone: "warm",
  aiResponseLength: "medium",
  aiName: "Jeff",
  plan: "enterprise",
  monthlyConversationQuota: 9999,
  businessType: "general",
};

const SAFE_KEYS = [
  "aiName",
  "businessType",
  "color",
  "displayName",
  "greeting",
  "logoUrl",
  "position",
  "subtitle",
] as const;

// Every CareTenantConfig field NOT surfaced (by its safe-name mapping) — these must never appear.
const INTERNAL_SENTINELS = [
  "SECRET-company-id",
  "https://SECRET-origin.example",
  "SECRET-signature",
  "SECRET-internal-product-playbook",
  "enterprise",
  9999,
];

describe("toWidgetSafeConfig — public bootstrap non-exposure", () => {
  const safe = toWidgetSafeConfig(FULL);

  it("returns EXACTLY the eight widget-safe keys (no more, no fewer)", () => {
    expect(Object.keys(safe).sort()).toEqual([...SAFE_KEYS]);
  });

  it("maps the safe fields through correctly", () => {
    expect(safe).toEqual({
      color: "#FACC15",
      greeting: "We're here to help",
      subtitle: "Ask us anything",
      position: "bottom-right",
      logoUrl: "https://cdn.example/logo.png",
      displayName: "Acme Co",
      aiName: "Jeff",
      businessType: "general",
    });
  });

  it("leaks NO internal field value (allowedOrigins, plan, quota, aiProductContext, signature, companyId, active)", () => {
    const serialized = JSON.stringify(safe);
    for (const sentinel of INTERNAL_SENTINELS) {
      expect(serialized).not.toContain(String(sentinel));
    }
    // Explicit key-absence too (belt and suspenders vs a value coincidence).
    for (const k of [
      "companyId",
      "allowedOrigins",
      "active",
      "plan",
      "monthlyConversationQuota",
      "replySignature",
      "aiProductContext",
      "aiTone",
      "aiResponseLength",
      "embedToken",
    ]) {
      expect(safe).not.toHaveProperty(k);
    }
  });
});
