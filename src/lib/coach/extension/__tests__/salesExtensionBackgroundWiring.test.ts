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

  const tools = ["dissect", "suggest", "extract"].map(
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

describe("Sales Coach worker — Suggested Response + Upload additions (2026-08-09)", () => {
  it("forwards the optional `guidance` key to /suggest (the merged action's steer)", () => {
    // Without this, a rep's typed draft/intent would be dropped and Suggested Response could only ever draft
    // from the conversation. Guards the payload-forwarding allowlist keeps `guidance`.
    expect(BG).toMatch(/message\.guidance[\s\S]{0,80}payload\.guidance/);
  });

  it("has a multipart 'sales-extract' upload handler that reuses the shared auth-retry", () => {
    expect(BG).toContain('"sales-extract"');
    expect(BG).toContain("salesExtractFetch");
    // the file path and the JSON tool path share ONE refresh-retry (no drift — the whole reason it was factored)
    expect(BG).toContain("function withAuthRetry");
    expect(BG).toMatch(/salesFetch[\s\S]*withAuthRetry/);
    expect(BG).toMatch(/salesExtractFetch[\s\S]*withAuthRetry/);
  });

  it("does NOT set Content-Type on the multipart upload (fetch must add the boundary itself)", () => {
    // A hardcoded application/json (or any Content-Type) on a FormData body breaks multipart parsing server-side.
    // Assert the extract fetch builds FormData and relies on fetch's own boundary.
    expect(BG).toContain("new FormData()");
    expect(BG).toMatch(/salesExtractFetch[\s\S]*FormData/);
  });
});

describe("Sales Coach worker — streaming Suggested Response (2026-08-09)", () => {
  it("relays a streaming Port named 'sales-suggest-stream' through the worker (CORS-free stream body)", () => {
    // A content-script fetch can't read a cross-origin stream body (CORS) — only the worker can, same reason as
    // the JSON tools. Guards that the onConnect relay + the SSE reader exist.
    expect(BG).toContain("onConnect");
    expect(BG).toContain('"sales-suggest-stream"');
    expect(BG).toContain("streamSalesSuggest");
    expect(BG).toContain("getReader()"); // reads the SSE body chunk-by-chunk
  });

  it("requests the stream (stream:true) and relays delta/done/error events to the panel", () => {
    expect(BG).toMatch(/stream:\s*true/);
    expect(BG).toContain("relaySalesSseEvent");
    expect(BG).toMatch(/type:\s*"delta"/);
    expect(BG).toMatch(/type:\s*"done"/);
    expect(BG).toMatch(/type:\s*"error"/);
  });

  it("shares ONE refresh-token step between the JSON path and the stream path (no drift)", () => {
    // The 401→refresh logic was factored into refreshSalesAccessToken so both withAuthRetry AND the streaming
    // fetch call it — re-inlining per site is exactly how the two drift (memory: shared-refresh discipline).
    expect(BG).toContain("function refreshSalesAccessToken");
    expect(BG).toMatch(/withAuthRetry[\s\S]*refreshSalesAccessToken/);
    expect(BG).toMatch(/streamSalesSuggest[\s\S]*refreshSalesAccessToken/);
  });

  it("stream path enforces the SAME endpoint allowlist (no open proxy on the port)", () => {
    // The onConnect handler must gate message.endpoint on ALLOWED_ENDPOINT just like the JSON path.
    expect(BG).toMatch(/onConnect[\s\S]*ALLOWED_ENDPOINT/);
  });

  it("ALWAYS disconnects the port when the reader loop ends (no hang on a done-less stream end)", () => {
    // Terminal guarantee: a stream that ends without a done/error event (server killed at the 60s cap, clean
    // EOF) must still resolve the panel — the worker disconnects in a finally so the client's onDisconnect fires
    // the fallback. Without this the panel hangs on "Drafting…" forever. Detection: fails if the finally-disconnect
    // is dropped.
    expect(BG).toMatch(/getReader\(\)[\s\S]*finally[\s\S]*port\.disconnect\(\)/);
  });
});
