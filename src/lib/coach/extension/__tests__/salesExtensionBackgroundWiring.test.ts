import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Port-completeness guard for the Sales Coach extension service worker (extension-sales/background.js).
 *
 * The worker is RUNTIME-UNVERIFIABLE (Chrome APIs, no browser here) and was PORTED from the C.A.R.E worker,
 * so the real risk is a half-done port: a leftover `care-*` message type / `careToken` / an RCD-or-image
 * handler that shouldn't be here, or a tool call escaping the coach-namespace endpoint allowlist. This locks
 * those static invariants; the browser behavior itself is confirmed live by the founder (same posture as the
 * C.A.R.E client). It also re-checks the security-critical endpoint allowlist against the real tool routes.
 */

const BG = readFileSync(join(process.cwd(), "extension-sales", "background.js"), "utf-8");

describe("Sales Coach extension worker — clean port (no C.A.R.E leftovers)", () => {
  it("uses the sales message types, not the C.A.R.E ones", () => {
    expect(BG).toContain('"sales-tool"');
    expect(BG).toContain('"sales-connect"');
    expect(BG).not.toContain('"care-tool"');
    expect(BG).not.toContain('"care-connect"');
  });

  it("stores the sales token keys, not the C.A.R.E ones", () => {
    expect(BG).toContain("salesCoachToken");
    expect(BG).not.toMatch(/\bcareToken\b/);
    expect(BG).not.toMatch(/\bcareRefreshToken\b/);
  });

  it("calls the COACH refresh route, not the C.A.R.E one", () => {
    expect(BG).toContain("/api/coach/extension/refresh");
    expect(BG).not.toContain("/api/care/extension/refresh");
  });

  it("dropped the RCD + image handlers (not in sales scope)", () => {
    expect(BG).not.toContain("care-rcd");
    expect(BG).not.toContain("care-image");
    expect(BG).not.toContain("rcd-ingest");
  });
});

describe("Sales Coach extension worker — endpoint allowlist (security)", () => {
  // Extract the ALLOWED_ENDPOINT regex literal from the source and exercise it against the real tool routes.
  const m = BG.match(/const ALLOWED_ENDPOINT\s*=\s*(\/.*?\/);/);
  const src = m?.[1];
  const allow = src ? (eval(src) as RegExp) : null; // eslint-disable-line no-eval -- a literal from our own file

  it("is defined in the worker", () => {
    expect(allow).not.toBeNull();
  });

  const tools = ["dissect", "coach", "summarize", "copilot", "formulate"].map(
    (k) => `/api/coach/extension/${k}`
  );
  it.each(tools)("allows the real tool endpoint %s", (endpoint) => {
    expect(allow!.test(endpoint)).toBe(true);
  });

  it("rejects path traversal and cross-host (no open proxy)", () => {
    expect(allow!.test("/api/coach/extension/../secret")).toBe(false);
    expect(allow!.test("https://evil.example.com/x")).toBe(false);
    expect(allow!.test("/api/care/extension/spawn")).toBe(false); // can't reach the C.A.R.E namespace either
  });
});
