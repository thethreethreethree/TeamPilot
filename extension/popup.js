// C.A.R.E extension popup logic (vanilla, no build). Reads the active tab's SELECTED text, runs a gated
// C.A.R.E tool endpoint, renders the result. Ephemeral: the selection is sent to run the tool and never
// stored locally (§3.4 / D1). Auth is a Bearer session token; full OAuth (D3) is scaffolded (see signIn).

const $ = (id) => document.getElementById(id);
let currentSelection = "";

function show(view) {
  for (const v of ["connect", "tools", "settings"]) $(v).classList.toggle("hide", v !== view);
}

async function refreshApiLabel() {
  const base = await getApiBase();
  $("apiLabel").textContent = base.replace(/^https?:\/\//, "");
}

function renderToolGrid() {
  const grid = $("toolGrid");
  grid.innerHTML = "";
  for (const tool of CARE_TOOLS) {
    const btn = document.createElement("button");
    btn.className = "tool";
    btn.disabled = !tool.endpoint || !currentSelection;
    btn.innerHTML =
      `<span class="t-label">${tool.label}</span>` +
      (tool.endpoint
        ? `<span class="t-desc">${tool.desc}</span>`
        : `<span class="soon">Coming</span><span class="t-desc">${tool.desc}</span>`);
    btn.addEventListener("click", () => runTool(tool));
    grid.appendChild(btn);
  }
}

async function readSelection() {
  const info = $("selInfo");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("no tab");
    const [{ result } = {}] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => (window.getSelection ? window.getSelection().toString() : ""),
    });
    currentSelection = (result || "").trim();
    if (!currentSelection) {
      info.textContent = "Nothing selected — highlight the conversation on the page, then click here again.";
    } else {
      info.textContent = `Selected ${currentSelection.length.toLocaleString()} characters. Pick a tool.`;
    }
  } catch {
    currentSelection = "";
    info.textContent = "Couldn't read the page (this site or a browser page may not allow it). Try highlighting text on a normal web page.";
  }
  info.classList.remove("hide");
  renderToolGrid();
}

async function runTool(tool) {
  const result = $("result");
  if (!tool.endpoint) {
    result.innerHTML = `<div class="rlabel">${tool.label}</div>This tool isn't wired up yet — it's shipping in a later build phase.`;
    result.classList.remove("hide");
    return;
  }
  if (!currentSelection) return;
  const base = await getApiBase();
  const token = await getToken();
  result.classList.remove("hide");
  result.innerHTML = `<div class="rlabel">${tool.label}</div><span class="spin"></span> Running…`;
  try {
    const res = await fetch(base + tool.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ conversation: currentSelection }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      result.innerHTML = `<div class="rlabel">${tool.label}</div>Your session expired. Reconnect.`;
      await chrome.storage.local.remove("careToken");
      setTimeout(init, 900);
      return;
    }
    if (res.status === 402) {
      const status = data?.entitlement?.status || "locked";
      result.innerHTML = `<div class="rlabel">${tool.label}</div>Your plan doesn't include the C.A.R.E extension (${status}). Upgrade to Pro or start a trial in your workspace.`;
      return;
    }
    if (!res.ok) {
      result.innerHTML = `<div class="rlabel">${tool.label}</div>${data?.error || "Something went wrong."}`;
      return;
    }
    // Each tool returns its own shape. Render accordingly (§3.4 — show the real output, honest-empty).
    let text;
    if (data.dissect) {
      const d = data.dissect;
      text = d.hasSignal
        ? `PROBLEM: ${d.problem?.statement || ""}\nWhy it matters: ${d.problem?.whyItMatters || ""}\n\n` +
          `ROOT CAUSE: ${d.rootCause || ""}\n\nOUTSIDE VIEW: ${d.outsideView || ""}\n\n` +
          `GUIDING QUESTION: ${d.guidingQuestion || ""}`
        : "Not enough in the selected text to dissect a clear problem yet — select more of the conversation.";
    } else {
      text = data.summary || data.reply || data.result || JSON.stringify(data, null, 2);
    }
    result.innerHTML = `<div class="rlabel">${tool.label}</div>${escapeHtml(text)}`;
  } catch {
    result.innerHTML = `<div class="rlabel">${tool.label}</div>Couldn't reach C.A.R.E. Check the API base URL in Settings, or your connection.`;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

async function init() {
  await refreshApiLabel();
  const token = await getToken();
  if (token) {
    show("tools");
    $("statusText").textContent = "Connected";
    currentSelection = "";
    $("selInfo").classList.add("hide");
    $("result").classList.add("hide");
    renderToolGrid();
  } else {
    show("connect");
  }
}

// ── Events ────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  init();

  $("readSelBtn").addEventListener("click", readSelection);

  $("signInBtn").addEventListener("click", async () => {
    // Full OAuth (launchWebAuthFlow, D3) needs a configured Google OAuth client — until then, open the app
    // login and use the developer token connect below. Honest about the state (§3.4).
    const base = await getApiBase();
    chrome.tabs.create({ url: base + "/login" });
  });

  $("tokenSaveBtn").addEventListener("click", async () => {
    const token = $("tokenInput").value.trim();
    if (!token) return;
    await chrome.storage.local.set({ careToken: token });
    init();
  });

  $("disconnectBtn").addEventListener("click", async () => {
    await chrome.storage.local.remove("careToken");
    init();
  });

  $("settingsBtn").addEventListener("click", async () => {
    $("apiInput").value = await getApiBase();
    show("settings");
  });
  $("apiSaveBtn").addEventListener("click", async () => {
    const v = $("apiInput").value.trim().replace(/\/$/, "");
    await chrome.storage.local.set({ apiBase: v || DEFAULT_API_BASE });
    await refreshApiLabel();
    init();
  });
  $("settingsBackBtn").addEventListener("click", init);
});
