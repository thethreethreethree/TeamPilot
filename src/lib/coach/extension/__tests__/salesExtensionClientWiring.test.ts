import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

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
const CONFIG = readFileSync(join(ROOT, "extension-sales", "config.js"), "utf-8");

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
    // Post-merge tools: dissect (Prospect Intel) → {dissect}, suggested → {reply, reasoning}.
    // The coach {coaching} and summarize {summary} branches were removed with their routes (2026-08-09).
    expect(CONTENT).toContain("data.dissect");
    expect(CONTENT).toContain("data.reply");
    expect(CONTENT).not.toContain("data.coaching"); // dead branch removed
    expect(CONTENT).not.toContain("data.summary"); // summarize tool removed (merged into Prospect Intel)
  });

  it("has a universal fallback extractor wired into capture (auto-capture works on ANY site, e.g. Instagram)", () => {
    // The site adapters are precise but brittle (IG reshuffles its obfuscated markup). universalExtract reads
    // the visible conversation generically when no adapter matches, so auto-capture doesn't depend on a fixed
    // selector. Order MUST be: try the site adapter → universalExtract → manual selection (last resort).
    expect(ADAPTERS).toContain("globalThis.universalExtract");
    expect(CONTENT).toMatch(/universalExtract\(\)/);
    expect(CONTENT).toMatch(/adapter\.extract[\s\S]{0,1200}universalExtract[\s\S]{0,600}getSelection/);
  });

  it("has a manual escape hatch: snapshots the page selection on mousedown and prefers it over auto-capture", () => {
    // With no Capture button, a click deselects page text — so we snapshot on mousedown (fires first) and a tool
    // run uses the rep's highlight when present, else auto-captures. Fails if the snapshot or the preference is dropped.
    expect(CONTENT).toContain("selectionAtMousedown");
    expect(CONTENT).toMatch(/"mousedown"[\s\S]{0,220}getSelection/);
    expect(CONTENT).toMatch(/if \(selectionAtMousedown\) setSelection[\s\S]{0,120}else captureConversation/);
  });

  it("dropped the C.A.R.E RCD/media capture UI", () => {
    expect(CONTENT).not.toContain("care-rcd");
    expect(CONTENT).not.toContain("extractRCD");
  });

  it("shows a distinct 'session expired → Sign in' state on a 401, not a generic error", () => {
    // After the worker's refresh fails it clears the token and returns 401; a generic "try again" is wrong
    // (retrying can't help). The panel must guide the rep to re-authenticate.
    expect(CONTENT).toMatch(/status === 401/);
    expect(CONTENT).toContain("Your session expired");
  });

  it("does not fire a REQUIRED-input tool on empty (refocuses), but ALLOWS an optional-input tool to run blank", () => {
    // A required input fired blank would 400 → confusing "something went wrong", so refocus. But Suggested
    // Response's guidance is OPTIONAL (blank = "draft from the conversation"), so the guard must exempt it —
    // otherwise the merged button could never run without typed guidance. The `&& !tool.input.optional` is the
    // load-bearing half; this fails on the pre-merge unconditional guard.
    expect(CONTENT).toMatch(/if \(!v && !tool\.input\.optional\) \{ if \(ta\) ta\.focus\(\); return; \}/);
    // and the config actually marks the suggested tool's input optional (so the exemption is reachable)
    expect(CONFIG).toMatch(/key:\s*"suggested"[\s\S]*optional:\s*true/);
  });

  it("tells the rep when a captured conversation was truncated (honest, not silent — §3.4)", () => {
    expect(CONTENT).toContain("trimmed to fit");
    expect(CONTENT).toMatch(/raw\.length > MAX_CHARS/);
  });

  it("previews the captured text, not just a count, so a wrong Tier-2 grab is self-evident (§3.4 for input)", () => {
    // A reasoned-but-unverified Tier-2 selector can match the wrong nodes and return plausible non-empty
    // garbage; a bare "N characters captured" looks identical for a right and a wrong grab, so the rep would
    // coach on garbage without knowing. The selinfo line must show a bounded preview of the actual captured
    // text so the mismatch is visible → the rep re-highlights manually. (Detection-tested: this fails on the
    // pre-fix count-only string.)
    expect(CONTENT).toMatch(/slice\(0,\s*90\)/);
    expect(CONTENT).toMatch(/characters captured[\s\S]{0,120}preview/);
  });

  it("keeps the RECENT tail of a long conversation, not the oldest head (port-gap from C.A.R.E)", () => {
    // A conversation runs oldest→newest and the coach tools need the LATEST turns ("what's the next move").
    // The C.A.R.E parent trims from the front (slice(-SELECTION_MAX)); the sales port shipped slice(0, MAX_CHARS),
    // which coaches on the OLDEST 20k and drops the recent messages — worst for an uploaded full-history file.
    // Detection-true: fails on the pre-fix head-trim.
    expect(CONTENT).toMatch(/currentSelection = raw\.slice\(-MAX_CHARS\)/);
    expect(CONTENT).not.toMatch(/currentSelection = raw\.slice\(0, MAX_CHARS\)/);
    // and the parent we mirror still tail-trims (guards the reference from silently changing under us)
    const CARE_CONTENT = readFileSync(join(ROOT, "extension", "content.js"), "utf-8");
    expect(CARE_CONTENT).toMatch(/slice\(-SELECTION_MAX\)/);
  });

  it("gives a signed-out rep an explicit Sign-in button, not just text (retry affordance)", () => {
    // If the connect tab is closed or the handoff fails, a bare "Sign in to use" text leaves no visible way to
    // retry (only the non-obvious re-click-a-tool). A button wired to open-connect is the clear path.
    expect(CONTENT).toContain('id="sc-signin"');
    expect(CONTENT).toMatch(/sc-signin[\s\S]{0,200}open-connect/);
  });

  it("gives the rep a Copy affordance on drafted output (workflow continuity, §1.5.1)", () => {
    // A drafted reply the rep must retype by hand is a dead-end; the C.A.R.E panel copies out and the sales
    // port must too. The copy is wired via a closure (copyTextFor → wireCopy), and the clipboard call is
    // guarded (it can throw). These lock the affordance since the browser behavior can't be run here.
    expect(CONTENT).toContain('id="sc-copy"');
    expect(CONTENT).toContain("function wireCopy");
    expect(CONTENT).toContain("function copyTextFor");
    expect(CONTENT).toContain("navigator.clipboard.writeText");
    // the clipboard call is inside a try/catch (never crashes the panel on a blocked page)
    expect(CONTENT).toMatch(/try\s*\{[\s\S]*navigator\.clipboard\.writeText[\s\S]*\}\s*catch/);
    // copyTextFor returns the reply/revision but NOT the internal "Move" reasoning (never copied to the inbox)
    expect(CONTENT).toMatch(/copyTextFor[\s\S]*data\.reply/);
    expect(CONTENT).not.toMatch(/copyTextFor[\s\S]*data\.reasoning/);
  });
});

describe("Sales Coach extension adapters.js — Tier-1 coverage + clean port", () => {
  it("exposes salesAdapterFor + textFrom", () => {
    expect(ADAPTERS).toContain("globalThis.salesAdapterFor");
    expect(ADAPTERS).toContain("globalThis.textFrom");
  });

  it("covers the 7 Tier-1 platforms (reuse the C.A.R.E selectors)", () => {
    for (const key of ["gmail", "outlook", "instagram", "messenger", "whatsapp", "linkedin", "slack"]) {
      expect(ADAPTERS).toContain(`key: "${key}"`);
    }
  });

  it("covers the 6 Tier-2 platforms (new adapters, reasoned selectors)", () => {
    for (const key of ["telegram", "teams", "discord", "twitter", "googlechat", "googlevoice"]) {
      expect(ADAPTERS).toContain(`key: "${key}"`);
    }
  });

  it("covers the 4 Tier-3 support-desk platforms (reuse the C.A.R.E desk selectors)", () => {
    for (const key of ["gorgias", "zendesk", "intercom", "front"]) {
      expect(ADAPTERS).toContain(`key: "${key}"`);
    }
  });

  it("dropped the C.A.R.E RCD/media helpers (text-only for sales)", () => {
    expect(ADAPTERS).not.toContain("rcdFrom");
    expect(ADAPTERS).not.toContain("rcdOrText");
    expect(ADAPTERS).not.toContain("defaultMediaFrom");
  });
});

describe("Sales Coach adapters.js — routing + extraction behavior (mirrors the C.A.R.E adapter guard)", () => {
  // A string-presence check would still pass if a `match:` predicate had a typo (e.g. "web.telegam.org"),
  // silently routing nothing. adapters.js is a browser global-style script; we load it in a vm with a mocked
  // `document` (the codebase pattern from src/lib/care/__tests__/extensionAdapters.test.ts) and assert the two
  // pure pieces verifiable without a real browser: host→adapter routing, and textFrom's extraction contract
  // (order, hidden-node skip, the §3.4 never-fabricate→empty guarantee, length cap). Live selectors against
  // real third-party DOMs are necessarily browser-confirmed per platform.
  type FakeNode = {
    innerText: string;
    textContent: string;
    offsetParent: object | null;
    getClientRects: () => object[];
    classList?: { contains: (c: string) => boolean };
  };
  const node = (text: string, hidden = false): FakeNode => ({
    innerText: text,
    textContent: text,
    offsetParent: hidden ? null : {},
    getClientRects: () => (hidden ? [] : [{}]),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function loadAdapters(nodesBySel: Record<string, FakeNode[]> = {}): any {
    // In a vm context `globalThis` inside the script resolves to the context object itself, so adapters.js's
    // `globalThis.salesAdapterFor = ...` lands directly on ctx (the C.A.R.E test relies on the same behavior).
    const ctx: Record<string, unknown> = {
      document: { querySelectorAll: (s: string) => nodesBySel[s] || [] },
      console,
    };
    vm.createContext(ctx);
    vm.runInContext(ADAPTERS, ctx);
    return ctx;
  }

  const routes: Array<[string, string]> = [
    ["mail.google.com", "gmail"],
    ["outlook.office.com", "outlook"],
    ["web.whatsapp.com", "whatsapp"],
    ["www.instagram.com", "instagram"],
    ["www.facebook.com", "messenger"],
    ["www.linkedin.com", "linkedin"],
    ["app.slack.com", "slack"],
    ["web.telegram.org", "telegram"],
    ["teams.microsoft.com", "teams"],
    ["discord.com", "discord"],
    ["x.com", "twitter"],
    ["chat.google.com", "googlechat"],
    ["voice.google.com", "googlevoice"],
    // Tier-3 support desks. The subdomain cases genuinely exercise the `.endsWith()` wildcard predicates —
    // a typo'd match (e.g. ".zendsk.com") would route null here, which a substring check could never catch.
    ["acme.zendesk.com", "zendesk"],
    ["shop.gorgias.com", "gorgias"],
    ["app.intercom.com", "intercom"],
    ["app.frontapp.com", "front"],
  ];

  it.each(routes)("routes %s → the %s adapter with a callable extract()", (host, key) => {
    const a = loadAdapters().salesAdapterFor(host);
    expect(a?.key).toBe(key);
    expect(typeof a?.extract).toBe("function");
  });

  it("returns null for an unknown host (→ manual selection fallback)", () => {
    expect(loadAdapters().salesAdapterFor("example.com")).toBeNull();
  });

  it("concatenates visible message bodies in document order", () => {
    const g = loadAdapters({ ".a3s": [node("Interested — what's pricing?"), node("Happy to walk you through it.")] });
    expect(g.salesAdapterFor("mail.google.com").extract()).toBe(
      "Interested — what's pricing?\n\nHappy to walk you through it."
    );
  });

  it("skips hidden nodes (e.g. collapsed quoted history)", () => {
    const g = loadAdapters({ ".a3s": [node("live text"), node("QUOTED OLD HISTORY", true)] });
    expect(g.salesAdapterFor("mail.google.com").extract()).not.toContain("QUOTED");
  });

  it("returns empty string when selectors match nothing — never fabricates (§3.4)", () => {
    expect(loadAdapters({}).salesAdapterFor("web.whatsapp.com").extract()).toBe("");
  });

  it("caps extracted text length to keep payloads bounded", () => {
    const g = loadAdapters({ "[data-pre-plain-text]": [node("x".repeat(30000))] });
    expect(g.salesAdapterFor("web.whatsapp.com").extract().length).toBe(20000);
  });

  it("WhatsApp lastSpeaker reads message direction (message-out = the rep → 'agent')", () => {
    const withClass = (text: string, out: boolean): FakeNode => ({
      ...node(text),
      classList: { contains: (c: string) => (c === "message-out" ? out : !out) },
    });
    const g = loadAdapters({ ".message-in, .message-out": [withClass("earlier", false), withClass("their reply", false)] });
    expect(g.salesAdapterFor("web.whatsapp.com").lastSpeaker()).toBe("customer");
    const g2 = loadAdapters({ ".message-in, .message-out": [withClass("my last line", true)] });
    expect(g2.salesAdapterFor("web.whatsapp.com").lastSpeaker()).toBe("agent");
    const g3 = loadAdapters({});
    expect(g3.salesAdapterFor("web.whatsapp.com").lastSpeaker()).toBeNull();
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

  it("pins the sales handoff to the SALES extension id, not C.A.R.E's (a crossed branch misdirects the token)", () => {
    // The message type is guarded above; this guards the security-critical OTHER half — the id the handoff
    // PINS TO. isExtensionHandoffAllowed is only as safe as allowedExtId, and the sales branch must derive it
    // from NEXT_PUBLIC_SALES_EXTENSION_ID. If a refactor crossed the ternary and pinned sales to
    // NEXT_PUBLIC_CARE_EXTENSION_ID, a sales sign-in would pin the session + refresh token to the wrong
    // extension. The regex asserts the exact branch ordering (sales ? SALES : CARE), so a swap fails CI.
    expect(CONNECT).toMatch(
      /sales\s*\?\s*process\.env\.NEXT_PUBLIC_SALES_EXTENSION_ID\s*:\s*process\.env\.NEXT_PUBLIC_CARE_EXTENSION_ID/
    );
  });
});

describe("Sales Coach manifest — least privilege (no copied-unused permissions from the C.A.R.E port)", () => {
  // A port copies the parent's manifest; C.A.R.E declares *.supabase.co + optional *://*/* ONLY for its RCD
  // image-capture flow, which sales dropped (text-only). An unused permission is the #1 Web Store rejection
  // reason. These lock the minimal surface so a future copy-paste re-adding one fails the build.
  const MANIFEST = JSON.parse(
    readFileSync(join(ROOT, "extension-sales", "manifest.json"), "utf-8")
  ) as { permissions: string[]; host_permissions?: string[]; optional_host_permissions?: string[] };

  it("requests only the API permissions it uses: activeTab, scripting, storage", () => {
    expect([...MANIFEST.permissions].sort()).toEqual(["activeTab", "scripting", "storage"]);
  });

  it("host_permissions are only the backend + localhost — no supabase, no all-hosts", () => {
    const hosts = MANIFEST.host_permissions ?? [];
    expect(hosts.length).toBeGreaterThan(0);
    for (const h of hosts) expect(h).toMatch(/(elostate\.com|localhost)/);
    expect(hosts.some((h) => /supabase/.test(h))).toBe(false);
    expect(hosts.some((h) => h === "<all_urls>" || /\*:\/\/\*/.test(h))).toBe(false);
  });

  it("declares NO optional_host_permissions (adapters run under activeTab; sales never calls chrome.permissions)", () => {
    expect(MANIFEST.optional_host_permissions ?? []).toEqual([]);
  });
});
