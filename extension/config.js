// C.A.R.E extension — shared config.
//
// API_BASE is where the C.A.R.E backend lives. Defaults to production; override for local dev by editing
// this value (e.g. http://localhost:4321) or via the popup's Settings field, which persists to chrome.storage.
const DEFAULT_API_BASE = "https://elostate.com";

// The six tools. `endpoint` null = not yet built server-side (Phase 0 shipped Summarize only). The popup
// renders the others honestly as "coming" rather than faking them (§3.4).
const CARE_TOOLS = [
  { key: "summarize", label: "Summarize", desc: "Catch up on the thread", endpoint: "/api/care/extension/summarize" },
  { key: "dissect", label: "Dissect", desc: "Find the real problem", endpoint: "/api/care/extension/dissect" },
  { key: "coach", label: "Ask Coach", desc: "Grade a draft vs the books", endpoint: null },
  { key: "copilot", label: "AI Co-pilot", desc: "Draft the reply + name the move", endpoint: null },
  { key: "formulate", label: "Formulate C.A.R.E", desc: "Shape your intent into a reply", endpoint: null },
  { key: "spawn", label: "Spawn task", desc: "Turn this into a C.A.R.E task", endpoint: null },
];

async function getApiBase() {
  try {
    const { apiBase } = await chrome.storage.local.get("apiBase");
    return apiBase || DEFAULT_API_BASE;
  } catch {
    return DEFAULT_API_BASE;
  }
}

async function getToken() {
  try {
    const { careToken } = await chrome.storage.local.get("careToken");
    return careToken || null;
  } catch {
    return null;
  }
}
