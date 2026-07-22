// C.A.R.E extension — on-page panel (content script).
//
// WHY this exists (founder feedback, 2026-07-22): the browser-action POPUP auto-closes the moment you click
// the page — which is fatal here, because using the tools means selecting text ON the page. A popup can't be
// "minimizable" or "not auto-close" (that's inherent to popups). So the UI is an injected in-page panel that:
//   • stays open until you close it (does not auto-close),
//   • minimizes to a small floating bubble,
//   • has an explicit ✕ close button.
//
// Injected via chrome.scripting.executeScript(["config.js","content.js"]) from the background worker on the
// toolbar-icon click, so it shares config.js's isolated world (getApiBase/getToken/CARE_TOOLS/DEFAULT_API_BASE).
// Style-isolated in a Shadow DOM so the host page's CSS can't touch it and vice-versa.
//
// §3.4 / D1: the panel reads only the text YOU selected, sends it to run the tool, and stores nothing locally.

(() => {
  // ── Idempotent mount: the icon toggles the panel instead of stacking copies ──────────────────────────────
  const HOST_ID = "care-ext-overlay-host";
  const existing = document.getElementById(HOST_ID);
  if (existing) {
    // Already mounted → toggle visibility (icon acts as show/hide). ✕ fully removes; this just hides.
    const hidden = existing.style.display === "none";
    existing.style.display = hidden ? "block" : "none";
    return;
  }

  let currentSelection = "";

  // ── Shadow host ──────────────────────────────────────────────────────────────────────────────────────────
  const host = document.createElement("div");
  host.id = HOST_ID;
  // Fixed, top-right, above almost everything. The host is a positioning shell; the panel lives in the shadow.
  host.style.cssText =
    "position:fixed;top:16px;right:16px;z-index:2147483646;width:auto;height:auto;margin:0;padding:0;";
  const root = host.attachShadow({ mode: "open" });
  document.documentElement.appendChild(host);

  // ink-950 #09090B ground, ink-900 #18181B panel, ember-400 #FACC15 accent — matches the C.A.R.E surface.
  const style = document.createElement("style");
  style.textContent = `
    :host, * { box-sizing: border-box; }
    .panel {
      width: 360px; max-width: calc(100vw - 32px); font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      background: #18181B; color: #FAFAFA; border: 1px solid rgba(255,255,255,0.10);
      border-radius: 14px; box-shadow: 0 20px 60px -12px rgba(0,0,0,0.65); overflow: hidden;
    }
    .hd { display:flex; align-items:center; gap:8px; padding:12px 12px 12px 14px; cursor:move; user-select:none;
      background:#09090B; border-bottom:1px solid rgba(255,255,255,0.08); }
    .brand { display:flex; align-items:center; gap:8px; font-weight:700; letter-spacing:0.02em; font-size:14px; }
    .dot { width:8px; height:8px; border-radius:50%; background:#3f3f46; box-shadow:0 0 0 0 rgba(250,204,21,0); }
    .dot.on { background:#22c55e; }
    .ver { font-size:10px; color:#71717a; font-weight:500; text-transform:uppercase; letter-spacing:0.08em; }
    .hd-sp { flex:1; }
    .icobtn { width:26px; height:26px; display:grid; place-items:center; border:none; border-radius:7px;
      background:transparent; color:#a1a1aa; cursor:pointer; font-size:15px; line-height:1; }
    .icobtn:hover { background:rgba(255,255,255,0.08); color:#fafafa; }
    .body { padding:14px; max-height:70vh; overflow:auto; }
    .consent { font-size:11px; line-height:1.5; color:#a1a1aa; background:rgba(255,255,255,0.03);
      border:1px solid rgba(255,255,255,0.06); border-radius:9px; padding:9px 11px; margin-bottom:12px; }
    .consent b { color:#e4e4e7; font-weight:600; }
    .primary { width:100%; border:none; border-radius:10px; background:#FACC15; color:#09090B; font-weight:700;
      font-size:14px; padding:11px; cursor:pointer; transition:background .12s; }
    .primary:hover { background:#EAB308; }
    .primary:disabled { opacity:.5; cursor:default; }
    .selinfo { font-size:11px; color:#a1a1aa; margin:10px 2px 4px; line-height:1.45; }
    .grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:10px; }
    .tool { text-align:left; border:1px solid rgba(255,255,255,0.09); border-radius:10px; background:rgba(255,255,255,0.02);
      color:#fafafa; padding:9px 10px; cursor:pointer; transition:border-color .12s, background .12s; }
    .tool:hover:not(:disabled) { border-color:rgba(250,204,21,0.5); background:rgba(250,204,21,0.06); }
    .tool:disabled { opacity:.55; cursor:default; }
    .t-label { display:block; font-weight:600; font-size:12.5px; }
    .t-desc { display:block; font-size:10.5px; color:#a1a1aa; margin-top:2px; line-height:1.35; }
    .soon { display:inline-block; font-size:8.5px; font-weight:700; letter-spacing:0.06em; color:#FACC15;
      vertical-align:top; margin-left:4px; }
    .result { margin-top:12px; font-size:12.5px; line-height:1.55; color:#e4e4e7; white-space:pre-wrap;
      background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:10px; padding:11px; }
    .rlabel { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.09em; color:#FACC15; margin-bottom:6px; }
    .ft { display:flex; align-items:center; justify-content:space-between; padding:9px 14px; font-size:11px;
      color:#71717a; border-top:1px solid rgba(255,255,255,0.07); background:#09090B; }
    .link { color:#FACC15; cursor:pointer; text-decoration:none; }
    .link:hover { text-decoration:underline; }
    .hide { display:none !important; }
    .spin { display:inline-block; width:10px; height:10px; border:2px solid rgba(250,204,21,0.3);
      border-top-color:#FACC15; border-radius:50%; animation:cspin .7s linear infinite; vertical-align:middle; margin-right:5px; }
    @keyframes cspin { to { transform:rotate(360deg); } }
    /* Minimized bubble */
    .bubble { width:46px; height:46px; border-radius:50%; background:#FACC15; color:#09090B; border:none;
      cursor:pointer; font-weight:800; font-size:15px; display:grid; place-items:center;
      box-shadow:0 10px 30px -8px rgba(0,0,0,0.6); }
    .bubble:hover { background:#EAB308; }
  `;
  root.appendChild(style);

  // ── Markup ───────────────────────────────────────────────────────────────────────────────────────────────
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <div class="panel" id="panel">
      <div class="hd" id="hd">
        <span class="brand"><span class="dot" id="dot"></span> C.A.R.E</span>
        <span class="hd-sp"></span>
        <span class="ver">v0.1</span>
        <button class="icobtn" id="minBtn" title="Minimize">–</button>
        <button class="icobtn" id="closeBtn" title="Close">✕</button>
      </div>
      <div class="body" id="body"></div>
      <div class="ft">
        <span id="apiLabel">elostate.com</span>
        <span id="connState"></span>
      </div>
    </div>
    <button class="bubble hide" id="bubble" title="Open C.A.R.E">C</button>
  `;
  root.appendChild(wrap);

  const $ = (id) => root.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

  // ── Minimize / close ─────────────────────────────────────────────────────────────────────────────────────
  $("minBtn").addEventListener("click", () => {
    $("panel").classList.add("hide");
    $("bubble").classList.remove("hide");
  });
  $("bubble").addEventListener("click", () => {
    $("bubble").classList.add("hide");
    $("panel").classList.remove("hide");
  });
  $("closeBtn").addEventListener("click", () => host.remove()); // full unmount; icon re-injects next time

  // ── Drag the header so the panel never traps the content underneath it ───────────────────────────────────
  (() => {
    const hd = $("hd");
    let sx = 0, sy = 0, ox = 0, oy = 0, dragging = false;
    hd.addEventListener("mousedown", (e) => {
      if (e.target.closest(".icobtn")) return;
      dragging = true;
      const r = host.getBoundingClientRect();
      // Switch from right-anchored to left/top-anchored so dragging is absolute.
      host.style.left = r.left + "px";
      host.style.top = r.top + "px";
      host.style.right = "auto";
      sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top;
      e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      host.style.left = Math.max(0, ox + (e.clientX - sx)) + "px";
      host.style.top = Math.max(0, oy + (e.clientY - sy)) + "px";
    });
    window.addEventListener("mouseup", () => { dragging = false; });
  })();

  // ── Silent token refresh (audit A4) ──────────────────────────────────────────────────────────────────────
  async function tryRefresh() {
    try {
      const { careRefreshToken } = await chrome.storage.local.get("careRefreshToken");
      if (!careRefreshToken) return false;
      const base = await getApiBase();
      const res = await fetch(base + "/api/care/extension/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: careRefreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json().catch(() => ({}));
      if (!data.access_token) return false;
      await chrome.storage.local.set({
        careToken: data.access_token,
        careRefreshToken: data.refresh_token || careRefreshToken,
      });
      return true;
    } catch {
      return false;
    }
  }

  // ── Tool run ─────────────────────────────────────────────────────────────────────────────────────────────
  async function runTool(tool, isRetry) {
    const out = $("result");
    if (!out) return;
    out.classList.remove("hide");
    if (!tool.endpoint) {
      out.innerHTML = `<div class="rlabel">${esc(tool.label)}</div>This tool isn't wired up yet — it's shipping in a later build phase.`;
      return;
    }
    if (!currentSelection) {
      out.innerHTML = `<div class="rlabel">${esc(tool.label)}</div>Highlight the conversation on the page first, then click “Read my selected text”.`;
      return;
    }
    const base = await getApiBase();
    const token = await getToken();
    out.innerHTML = `<div class="rlabel">${esc(tool.label)}</div><span class="spin"></span>Running…`;
    try {
      const res = await fetch(base + tool.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ conversation: currentSelection }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        if (!isRetry && (await tryRefresh())) return runTool(tool, true);
        out.innerHTML = `<div class="rlabel">${esc(tool.label)}</div>Your session expired. Click Sign in to reconnect.`;
        await chrome.storage.local.remove(["careToken", "careRefreshToken"]);
        setTimeout(render, 800);
        return;
      }
      if (res.status === 402) {
        const status = data?.entitlement?.status || "locked";
        out.innerHTML = `<div class="rlabel">${esc(tool.label)}</div>Your plan doesn't include the C.A.R.E extension (${esc(status)}). Upgrade to Pro or start a trial in your workspace.`;
        return;
      }
      if (!res.ok) {
        out.innerHTML = `<div class="rlabel">${esc(tool.label)}</div>${esc(data?.error || "Something went wrong.")}`;
        return;
      }
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
      out.innerHTML = `<div class="rlabel">${esc(tool.label)}</div>${esc(text)}`;
    } catch {
      out.innerHTML = `<div class="rlabel">${esc(tool.label)}</div>Couldn't reach C.A.R.E. Check your connection.`;
    }
  }

  function readSelection() {
    currentSelection = (window.getSelection ? window.getSelection().toString() : "").trim();
    const info = $("selInfo");
    if (info) {
      info.textContent = currentSelection
        ? `Selected ${currentSelection.length.toLocaleString()} characters. Pick a tool.`
        : "Nothing selected — highlight the conversation on the page, then click again.";
    }
    // enable/disable the tool buttons that need a selection
    root.querySelectorAll(".tool[data-endpoint]").forEach((b) => { b.disabled = !currentSelection; });
  }

  // ── Views ────────────────────────────────────────────────────────────────────────────────────────────────
  function toolsView() {
    const grid = CARE_TOOLS.map((t, i) => {
      const soon = t.endpoint ? "" : `<span class="soon">SOON</span>`;
      const dis = t.endpoint ? "" : "disabled";
      return `<button class="tool" data-i="${i}" ${t.endpoint ? 'data-endpoint="1"' : ""} ${dis}>
        <span class="t-label">${esc(t.label)}${soon}</span><span class="t-desc">${esc(t.desc)}</span></button>`;
    }).join("");
    $("body").innerHTML = `
      <div class="consent">We only read the text you have <b>selected</b> on the page. It's processed to help you and <b>not stored</b>.</div>
      <button class="primary" id="readSelBtn">Read my selected text</button>
      <div class="selinfo" id="selInfo">Highlight a conversation on the page, then click above.</div>
      <div class="grid">${grid}</div>
      <div class="result hide" id="result"></div>`;
    $("readSelBtn").addEventListener("click", readSelection);
    root.querySelectorAll(".tool").forEach((btn) => {
      btn.addEventListener("click", () => runTool(CARE_TOOLS[Number(btn.dataset.i)]));
    });
    readSelection();
  }

  function connectView() {
    $("body").innerHTML = `
      <div class="consent">Sign in with your C.A.R.E account to use the tools on this page. The extension needs a
        paid plan or an active trial.</div>
      <button class="primary" id="signInBtn">Sign in</button>
      <div class="selinfo">After you sign in, this panel connects automatically — come back to this tab.</div>`;
    $("signInBtn").addEventListener("click", () => {
      // Content scripts can't open tabs; ask the background worker to open the one-click connect page.
      chrome.runtime.sendMessage({ type: "open-connect" });
    });
  }

  async function render() {
    const base = await getApiBase();
    $("apiLabel").textContent = base.replace(/^https?:\/\//, "");
    const token = await getToken();
    if (token) {
      $("dot").classList.add("on");
      $("connState").innerHTML = `<span class="link" id="dcBtn">Disconnect</span>`;
      toolsView();
      $("dcBtn").addEventListener("click", async () => {
        await chrome.storage.local.remove(["careToken", "careRefreshToken"]);
        render();
      });
    } else {
      $("dot").classList.remove("on");
      $("connState").textContent = "Not connected";
      connectView();
    }
  }

  // Re-render if the token lands while the panel is open (e.g. the connect tab hands off in the background).
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.careToken) render();
  });

  render();
})();
