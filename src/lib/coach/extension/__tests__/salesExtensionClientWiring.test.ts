import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Port-completeness guard for the Sales Coach extension CLIENT files that ship in the downloadable package
 * (content.js panel + adapters.js per-site readers). Both are RUNTIME-UNVERIFIABLE (shadow DOM / page DOM,
 * no browser here) and ported from the C.A.R.E client, so the real risk is a half-done port: a leftover
 * `care-*` message / `CARE_TOOLS` / `careAdapterFor`, or a tool-result render that doesn't match the server
 * shape. This locks the static invariants; the browser behavior is confirmed live by the founder.
 */

const ROOT = process.cwd();
const CONTENT = readFileSync(join(ROOT, "extension-sales", "content.js"), "utf-8");
const ADAPTERS = readFileSync(join(ROOT, "extension-sales", "adapters.js"), "utf-8");

describe("Sales Coach extension content.js — clean port + correct protocol", () => {
  it("reads the sales shared globals, not the C.A.R.E ones", () => {
    expect(CONTENT).toContain("SALES_TOOLS");
    expect(CONTENT).toContain("salesAdapterFor");
    expect(CONTENT).not.toContain("CARE_TOOLS");
    expect(CONTENT).not.toContain("careAdapterFor");
  });

  it("posts the sales-tool message to the worker (not care-tool)", () => {
    expect(CONTENT).toContain('"sales-tool"');
    expect(CONTENT).not.toContain('"care-tool"');
  });

  it("renders each tool's server result shape", () => {
    // dissect → {dissect}, coach → {coaching}, summarize → {summary}, copilot/formulate → {reply, reasoning}
    expect(CONTENT).toContain("data.dissect");
    expect(CONTENT).toContain("data.coaching");
    expect(CONTENT).toContain("data.summary");
    expect(CONTENT).toContain("data.reply");
  });

  it("dropped the C.A.R.E RCD/media capture UI", () => {
    expect(CONTENT).not.toContain("care-rcd");
    expect(CONTENT).not.toContain("extractRCD");
  });
});

describe("Sales Coach extension adapters.js — Tier-1 coverage + clean port", () => {
  it("exposes salesAdapterFor + textFrom", () => {
    expect(ADAPTERS).toContain("globalThis.salesAdapterFor");
    expect(ADAPTERS).toContain("globalThis.textFrom");
  });

  it("covers the 7 Tier-1 platforms", () => {
    for (const key of ["gmail", "outlook", "instagram", "messenger", "whatsapp", "linkedin", "slack"]) {
      expect(ADAPTERS).toContain(`key: "${key}"`);
    }
  });

  it("dropped the C.A.R.E RCD/media helpers (text-only for sales)", () => {
    expect(ADAPTERS).not.toContain("rcdFrom");
    expect(ADAPTERS).not.toContain("rcdOrText");
    expect(ADAPTERS).not.toContain("defaultMediaFrom");
  });
});

describe("Sales Coach downloadable package — the served zip + wiring", () => {
  it("the built zip exists (public/sales-coach-extension.zip)", () => {
    expect(existsSync(join(ROOT, "public", "sales-coach-extension.zip"))).toBe(true);
  });

  it("the download page links the correct zip", () => {
    const page = readFileSync(join(ROOT, "src", "app", "extension", "download-sales", "page.tsx"), "utf-8");
    expect(page).toContain('href="/sales-coach-extension.zip"');
  });

  it("the Sales Coach page links to the download page", () => {
    const scPage = readFileSync(join(ROOT, "src", "app", "dashboard", "sales-coach", "page.tsx"), "utf-8");
    expect(scPage).toContain("/extension/download-sales");
  });
});

describe("Sales Coach connect handoff — message type matches the worker (cross-artifact sync)", () => {
  const CONNECT = readFileSync(join(ROOT, "src", "app", "extension", "connect", "page.tsx"), "utf-8");
  const BG = readFileSync(join(ROOT, "extension-sales", "background.js"), "utf-8");

  it("the connect page emits 'sales-connect' and the worker listens for exactly that", () => {
    // If these ever drift, the panel's Sign in would deliver a token the worker ignores — silent auth failure.
    expect(CONNECT).toContain("sales-connect");
    expect(BG).toContain('message.type !== "sales-connect"');
  });

  it("the connect page still defaults to C.A.R.E (care-connect preserved — no regression)", () => {
    expect(CONNECT).toContain("care-connect");
  });

  it("the worker opens the connect page with product=sales (so the page picks the sales branch)", () => {
    expect(BG).toContain("product=sales");
  });
});
