// Sales Coach extension — shared config.
//
// SEPARATE standalone extension (founder decision 2026-08-08), sibling to the C.A.R.E extension in
// ../extension. Injected (with adapters.js + content.js) on every toolbar-icon click so the panel can
// toggle. Chrome injects into ONE persistent global scope per frame that survives across executeScript
// calls, so a bare top-level `const` would throw "already declared" on the SECOND injection. We publish to
// globalThis behind an idempotency guard (a DISTINCT key from the C.A.R.E extension's, so the two can run
// side by side without clobbering each other's globals): safe to re-inject; content.js reads these as bare
// names via the shared global.

if (!globalThis.__salesCoachConfigLoaded) {
  globalThis.__salesCoachConfigLoaded = true;

  // Where the backend lives. Defaults to production; override for local dev by setting `apiBase` in
  // chrome.storage.local (e.g. http://localhost:4321).
  globalThis.DEFAULT_API_BASE = "https://elostate.com";

  // The sales tools. Each `endpoint` points at a Sales Coach extension route (built Phase 1, server side).
  // `input` = an extra field the tool needs from the rep (Coach grades their DRAFT) — the panel shows a
  // textarea for those before running; the others run on the scanned conversation alone. The
  // salesExtensionConfigWiring test asserts every endpoint here maps to a real route.ts (no dead tool).
  globalThis.SALES_TOOLS = [
    { key: "summarize", label: "Catch me up", desc: "Where this deal stands", endpoint: "/api/coach/extension/summarize" },
    { key: "dissect", label: "Read the room", desc: "What's working + the next move", endpoint: "/api/coach/extension/dissect" },
    { key: "coach", label: "Coach my reply", desc: "Grade your draft vs the sales books", endpoint: "/api/coach/extension/coach",
      input: { key: "draft", label: "Your draft reply", placeholder: "Paste or type the reply you're about to send…", max: 8000 } },
    { key: "copilot", label: "Draft my reply", desc: "Draft the next message + name the move", endpoint: "/api/coach/extension/copilot" },
    { key: "formulate", label: "Say it for me", desc: "Shape what you want to say into a strong message", endpoint: "/api/coach/extension/formulate",
      input: { key: "intent", label: "What do you want to get across?", placeholder: "e.g. I want to acknowledge the price concern but hold the value…", max: 2000 } },
  ];

  globalThis.getApiBase = async function getApiBase() {
    try {
      const { apiBase } = await chrome.storage.local.get("apiBase");
      return apiBase || globalThis.DEFAULT_API_BASE;
    } catch {
      return globalThis.DEFAULT_API_BASE;
    }
  };

  // Auth token — stored under a DISTINCT key (salesCoachToken) from the C.A.R.E extension's own token key, so
  // the two extensions authenticate independently even when both are installed. Set by the connect page on link.
  globalThis.getToken = async function getToken() {
    try {
      const { salesCoachToken } = await chrome.storage.local.get("salesCoachToken");
      return salesCoachToken || null;
    } catch {
      return null;
    }
  };
}
