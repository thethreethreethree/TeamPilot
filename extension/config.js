// C.A.R.E extension — shared config.
//
// Injected (with adapters.js + content.js) on every toolbar-icon click so the panel can toggle. Chrome injects
// into ONE persistent global scope per frame, and that scope survives across executeScript calls — so a bare
// top-level `const` here would throw "already declared" on the SECOND injection and break the toggle. We instead
// publish to globalThis behind an idempotency guard: safe to re-inject, and content.js reads these as bare
// names (they resolve via the shared global).

if (!globalThis.__careConfigLoaded) {
  globalThis.__careConfigLoaded = true;

  // API_BASE is where the C.A.R.E backend lives. Defaults to production; override for local dev by setting the
  // `apiBase` key in chrome.storage.local (e.g. http://localhost:4321).
  globalThis.DEFAULT_API_BASE = "https://elostate.com";

  // The six tools. `endpoint` null = not yet built server-side. `input` = an extra field the tool needs from the
  // agent (Coach grades their DRAFT; Formulate shapes their INTENT) — the panel shows a textarea for those before
  // running; the other four run on the scanned conversation alone. The UI renders any null-endpoint tool honestly
  // as "SOON" rather than faking it (§3.4).
  globalThis.CARE_TOOLS = [
    { key: "summarize", label: "Summarize", desc: "Catch up on the thread", endpoint: "/api/care/extension/summarize" },
    { key: "dissect", label: "Dissect", desc: "Find the real problem", endpoint: "/api/care/extension/dissect" },
    { key: "coach", label: "Ask Coach", desc: "Grade a draft vs the books", endpoint: "/api/care/extension/coach",
      input: { key: "draft", label: "Your draft reply", placeholder: "Paste or type the reply you're about to send…", max: 8000 } },
    { key: "copilot", label: "AI Co-pilot", desc: "Draft the reply + name the move", endpoint: "/api/care/extension/copilot" },
    { key: "formulate", label: "Formulate C.A.R.E", desc: "Shape your intent into a reply", endpoint: "/api/care/extension/formulate",
      input: { key: "intent", label: "What do you want to say?", placeholder: "e.g. tell them the refund is approved but it takes 5 days…", max: 2000 } },
    { key: "spawn", label: "Spawn task", desc: "Turn this into a C.A.R.E task", endpoint: "/api/care/extension/spawn" },
  ];

  globalThis.getApiBase = async function getApiBase() {
    try {
      const { apiBase } = await chrome.storage.local.get("apiBase");
      return apiBase || globalThis.DEFAULT_API_BASE;
    } catch {
      return globalThis.DEFAULT_API_BASE;
    }
  };

  globalThis.getToken = async function getToken() {
    try {
      const { careToken } = await chrome.storage.local.get("careToken");
      return careToken || null;
    } catch {
      return null;
    }
  };
}
