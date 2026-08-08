// Sales Coach extension — shared config.
//
// SEPARATE standalone extension (founder decision 2026-08-08), sibling to the C.A.R.E extension in
// ../extension. Injected (with adapters.js + content.js) on every toolbar-icon click so the panel can
// toggle. Chrome re-injects into THIS extension's isolated world (which persists across executeScript calls)
// on every click, so a bare top-level `const` would throw "already declared" on re-injection — the
// idempotency guard below prevents that. The token / guard / tools names are deliberately DISTINCT from the
// C.A.R.E extension's — NOT because the two could otherwise collide (each extension runs in its OWN isolated
// world with its OWN chrome.storage, so it can't) but as defensive clarity and to catch a copy-paste that
// left C.A.R.E names in this file. content.js reads these as bare names via the shared (per-extension) global.

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
    // "Suggested Response" (2026-08-09) merges the former Coach-my-reply / Draft-my-reply / Say-it-for-me into
    // ONE action. The guidance box is OPTIONAL (`optional: true`): blank → the server drafts from the
    // conversation (co-pilot engine); filled → it shapes your draft/intent (formulate engine). Both return a
    // ready-to-send reply + the move. content.js honors `optional` so a blank Run is allowed here (unlike the
    // required-input tools, which refocus on empty).
    { key: "suggested", label: "Suggested Response", desc: "A strong reply to send — optionally guided by your draft or intent", endpoint: "/api/coach/extension/suggest",
      input: { key: "guidance", label: "Optional — your draft, or what you want to get across", placeholder: "Leave blank to draft from the conversation, or type your draft / intent…", max: 8000, optional: true } },
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
