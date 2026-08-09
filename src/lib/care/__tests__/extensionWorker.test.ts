import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

/**
 * Regression guard for the extension background worker's careFetch (extension/background.js) — the auth
 * orchestration that was moved OUT of the content script because a content-script fetch is CORS-blocked on
 * host sites. careFetch holds the token, calls the API, and does the silent-refresh-and-retry (audit A4).
 *
 * We load background.js in a vm with a mocked `chrome` + `fetch` and drive the four paths: happy, expired→
 * refresh→retry, refresh-fails→clear-session, and no-refresh-token passthrough.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Store = Record<string, any>;
const jsonRes = (status: number, body: unknown) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => body,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadWorker(store: Store, fetchImpl: (...a: any[]) => Promise<any>): any {
  const src = readFileSync(join(__dirname, "../../../../extension/background.js"), "utf8");
  const noop = { addListener: () => {} };
  const chrome = {
    storage: {
      local: {
        get: async (keys: string | string[]) => {
          const k = Array.isArray(keys) ? keys : [keys];
          const o: Store = {};
          for (const key of k) o[key] = store[key];
          return o;
        },
        set: async (obj: Store) => {
          Object.assign(store, obj);
        },
        remove: async (keys: string | string[]) => {
          for (const key of ([] as string[]).concat(keys)) delete store[key];
        },
      },
      onChanged: noop,
    },
    action: { onClicked: noop, setBadgeText: () => {}, setBadgeBackgroundColor: () => {} },
    runtime: { onMessage: noop, onMessageExternal: noop, onConnect: noop, id: "extid" },
    tabs: { create: () => {} },
    scripting: {},
  };
  const ctx: Record<string, unknown> = { chrome, fetch: fetchImpl, console };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return ctx;
}

describe("extension background worker — careFetch", () => {
  it("happy path: a good token returns the API result", async () => {
    const store: Store = { careToken: "good", careRefreshToken: "r", apiBase: "https://x" };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = loadWorker(store, async (url: string, opt: any) => {
      if (url.endsWith("/summarize") && opt.headers.Authorization === "Bearer good")
        return jsonRes(200, { summary: "S" });
      return jsonRes(500, {});
    });
    const out = await ctx.careFetch("/api/care/extension/summarize", { conversation: "x" });
    expect(out.status).toBe(200);
    expect(out.data.summary).toBe("S");
  });

  it("expired token: refreshes, retries, stores the rotated tokens", async () => {
    const store: Store = { careToken: "expired", careRefreshToken: "r", apiBase: "https://x" };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = loadWorker(store, async (url: string, opt: any) => {
      if (url.endsWith("/refresh")) return jsonRes(200, { access_token: "newtok", refresh_token: "r2" });
      if (url.endsWith("/summarize") && opt.headers?.Authorization === "Bearer expired")
        return jsonRes(401, { error: "expired" });
      if (url.endsWith("/summarize") && opt.headers?.Authorization === "Bearer newtok")
        return jsonRes(200, { summary: "S2" });
      return jsonRes(500, {});
    });
    const out = await ctx.careFetch("/api/care/extension/summarize", { conversation: "x" });
    expect(out.status).toBe(200);
    expect(out.data.summary).toBe("S2");
    expect(store.careToken).toBe("newtok");
    expect(store.careRefreshToken).toBe("r2");
  });

  it("refresh fails: clears the session and surfaces 401", async () => {
    const store: Store = { careToken: "expired", careRefreshToken: "bad", apiBase: "https://x" };
    const ctx = loadWorker(store, async (url: string) =>
      url.endsWith("/refresh") ? jsonRes(401, { error: "nope" }) : jsonRes(401, { error: "expired" })
    );
    const out = await ctx.careFetch("/api/care/extension/summarize", { conversation: "x" });
    expect(out.status).toBe(401);
    expect(store.careToken).toBeUndefined();
    expect(store.careRefreshToken).toBeUndefined();
  });

  it("no refresh token: passes the 401 through without crashing", async () => {
    const store: Store = { careToken: "expired", apiBase: "https://x" };
    const ctx = loadWorker(store, async () => jsonRes(401, { error: "expired" }));
    const out = await ctx.careFetch("/api/care/extension/summarize", { conversation: "x" });
    expect(out.status).toBe(401);
  });
});

/**
 * Structural invariant guard for the CORS architecture (the session's most critical fix). A content-script
 * fetch to the API is CORS-refused on host sites, so ALL network must go through the background worker. If a
 * future change moves a fetch back into content.js, the tools silently break on every site — this catches it.
 */
describe("extension CORS architecture invariant", () => {
  const read = (f: string) => readFileSync(join(__dirname, "../../../../extension", f), "utf8");

  it("content.js makes no direct network calls (all routed through the worker)", () => {
    const src = read("content.js");
    // Strip comments so an explanatory mention of fetch in a comment doesn't trip the guard.
    const code = src.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(code).not.toMatch(/\bfetch\s*\(/);
    expect(code).not.toMatch(/XMLHttpRequest/);
  });

  it("content.js dispatches tool runs to the worker via sendMessage", () => {
    // The CORS invariant: tool runs reach the worker through chrome.runtime.sendMessage with a "care-tool"
    // message. Assert the two facts independently (the message may be built as a variable or inline — coupling
    // to the object-literal syntax made this false-alarm when runTool started forwarding optional tool inputs).
    const code = read("content.js");
    expect(code).toMatch(/chrome\.runtime\.sendMessage\(/);
    expect(code).toMatch(/type:\s*["']care-tool["']/);
  });

  it("background.js validates the endpoint before fetching (no open proxy)", () => {
    const src = read("background.js");
    expect(src).toMatch(/ALLOWED_ENDPOINT|\/\^\\\/api\\\/care\\\/extension/);
    expect(src).toMatch(/\bfetch\s*\(/); // the worker is where fetch legitimately lives
  });

  // ── Streaming Co-Pilot (2026-08-09, mirrors Sales Coach) ──────────────────────────────────────────────
  it("background.js relays a streaming Port ('care-copilot-stream') and reads the SSE body in the worker", () => {
    const src = read("background.js");
    expect(src).toContain("onConnect");
    expect(src).toContain('"care-copilot-stream"');
    expect(src).toContain("streamCareCopilot");
    expect(src).toContain("getReader()");
    expect(src).toMatch(/stream:\s*true/);
    expect(src).toContain("relayCareSseEvent");
  });

  it("background.js shares ONE refresh step between the JSON path and the stream path (no drift)", () => {
    const src = read("background.js");
    expect(src).toContain("function refreshCareAccessToken");
    expect(src).toMatch(/careFetch[\s\S]*refreshCareAccessToken/);
    expect(src).toMatch(/streamCareCopilot[\s\S]*refreshCareAccessToken/);
  });

  it("background.js stream port enforces the SAME endpoint allowlist (no open proxy on the port)", () => {
    expect(read("background.js")).toMatch(/onConnect[\s\S]*ALLOWED_ENDPOINT/);
  });

  it("background.js ALWAYS disconnects the port when the reader loop ends (no hang on a done-less stream end)", () => {
    // A stream that ends without a done/error event (server killed at the 60s cap, clean EOF) must still resolve
    // the panel — the worker disconnects in a finally so the client's onDisconnect fires the fallback. Without
    // this the panel hangs on "Drafting…" forever.
    expect(read("background.js")).toMatch(/getReader\(\)[\s\S]*finally[\s\S]*port\.disconnect\(\)/);
  });

  it("content.js streams the Co-Pilot and falls back to the request path on any failure", () => {
    const code = read("content.js");
    expect(code).toContain("runCopilotStreaming");
    expect(code).toMatch(/chrome\.runtime\.connect\(\{\s*name:\s*"care-copilot-stream"/);
    expect(code).toContain("===REASONING===");
    // fallback re-runs the proven request path with noStream=true; guards it can't break the working flow
    expect(code).toMatch(/onDisconnect[\s\S]{0,120}fallback/);
    expect(code).toMatch(/fallback[\s\S]{0,200}runTool\(tool, undefined, true\)/);
    // honest staged progress (mirrors Sales Coach), C.A.R.E's OWN care phrasing
    expect(code).toContain("function startProgressCare");
    expect(code).toContain("Reading the conversation…");
  });
});
