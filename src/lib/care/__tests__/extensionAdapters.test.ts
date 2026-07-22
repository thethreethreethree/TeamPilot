import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

/**
 * Regression guard for the browser extension's per-site adapters (extension/adapters.js).
 *
 * adapters.js is a plain browser global-style script (no module system — it's injected into a content-script
 * world). We load it in a vm with a mocked `document` and assert the two pure pieces we CAN verify without a
 * real browser: host→adapter routing, and DOM→text extraction (order, hidden-node skipping, graceful-empty,
 * length cap). The selectors themselves against live third-party DOMs are necessarily browser-tested; this
 * locks the routing + the "never fabricate, fall back to manual selection" contract (§3.4).
 */

type FakeNode = { innerText: string; textContent: string; offsetParent: object | null; getClientRects: () => object[] };
const node = (text: string, hidden = false): FakeNode => ({
  innerText: text,
  textContent: text,
  offsetParent: hidden ? null : {},
  getClientRects: () => (hidden ? [] : [{}]),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadAdapters(nodesBySel: Record<string, FakeNode[]> = {}): any {
  const src = readFileSync(join(__dirname, "../../../../extension/adapters.js"), "utf8");
  const ctx: Record<string, unknown> = {
    document: { querySelectorAll: (s: string) => nodesBySel[s] || [] },
    console,
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return ctx;
}

describe("extension per-site adapters", () => {
  const routes: Array<[string, string]> = [
    ["mail.google.com", "gmail"],
    ["outlook.office.com", "outlook"],
    ["www.instagram.com", "instagram"],
    ["www.messenger.com", "messenger"],
    ["www.facebook.com", "messenger"],
    ["web.whatsapp.com", "whatsapp"],
    ["www.linkedin.com", "linkedin"],
    ["shop.gorgias.com", "gorgias"],
    ["acme.zendesk.com", "zendesk"],
    ["app.intercom.com", "intercom"],
    ["app.frontapp.com", "front"],
  ];

  it.each(routes)("routes %s to the %s adapter", (host, key) => {
    expect(loadAdapters().careAdapterFor(host)?.key).toBe(key);
  });

  it("returns null for an unknown host (universal selection-only mode)", () => {
    expect(loadAdapters().careAdapterFor("news.ycombinator.com")).toBeNull();
  });

  it("concatenates visible message bodies in document order", () => {
    const ctx = loadAdapters({ ".a3s": [node("Hi, my refund is late."), node("We're on it.")] });
    expect(ctx.careAdapterFor("mail.google.com").extract()).toBe("Hi, my refund is late.\n\nWe're on it.");
  });

  it("skips hidden nodes (e.g. Gmail's collapsed quoted history)", () => {
    const ctx = loadAdapters({ ".a3s": [node("live text"), node("QUOTED OLD HISTORY", true)] });
    expect(ctx.careAdapterFor("mail.google.com").extract()).not.toContain("QUOTED");
  });

  it("returns empty string when selectors match nothing — never fabricates (§3.4)", () => {
    expect(loadAdapters({}).careAdapterFor("web.whatsapp.com").extract()).toBe("");
  });

  it("caps extracted text length to keep payloads bounded", () => {
    const ctx = loadAdapters({ ".a3s": [node("x".repeat(30000))] });
    expect(ctx.careAdapterFor("mail.google.com").extract().length).toBe(20000);
  });
});
