import { describe, it, expect } from "vitest";
import { enabledProviders, oauthErrorMessage, safeNext } from "../oauthProviders";

describe("enabledProviders", () => {
  it("shows only what the operator listed, in a fixed order; 'microsoft' means azure", () => {
    expect(enabledProviders(undefined)).toEqual([]);
    expect(enabledProviders("")).toEqual([]);
    expect(enabledProviders("azure, Google")).toEqual(["google", "azure"]);
    expect(enabledProviders("microsoft")).toEqual(["azure"]);
    expect(enabledProviders("github,google")).toEqual(["google"]);
  });
});

describe("safeNext (delegates to the app's open-redirect guard)", () => {
  it("keeps same-site paths and refuses everything else", () => {
    expect(safeNext("/dashboard/sales-coach")).toBe("/dashboard/sales-coach");
    for (const bad of ["//evil.example.com", "/\\evil.example.com", "https://evil.example.com", "javascript:alert(1)", "", null]) {
      expect(safeNext(bad)).toBe("/dashboard");
    }
  });
});

describe("oauthErrorMessage", () => {
  it("shows a fixed sentence for a known code and nothing for anything else (no text injection on the login page)", () => {
    expect(oauthErrorMessage("oauth_failed")).toMatch(/didn't complete/);
    expect(oauthErrorMessage("Your account is locked, call 555-0100")).toBe("");
    expect(oauthErrorMessage(null)).toBe("");
  });
});
