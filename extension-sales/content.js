// Sales Coach extension — on-page panel (content script).
//
// Injected (with config.js + adapters.js) on the toolbar-icon click; they share one isolated world, so this
// reads SALES_TOOLS / getApiBase / getToken / salesAdapterFor as bare globals. Network calls go through the
// background worker (CORS): this posts {type:"sales-tool", …} and renders {status,data}.
//
// A FOCUSED port of ../extension/content.js — the C.A.R.E RCD-capture + media-upload UI is intentionally
// DROPPED (sales has only the text tools). ⚠️ RUNTIME-UNVERIFIED (shadow DOM / Chrome APIs, no browser in the
// build sandbox); confirmed live by the founder, same posture as the C.A.R.E panel.

(function () {
  const HOST_ID = "sales-coach-ext-overlay-host";

  // Toggle: a second toolbar click removes the panel.
  const existing = document.getElementById(HOST_ID);
  if (existing) {
    existing.remove();
    return;
  }

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.style.cssText =
    "position:fixed;top:16px;right:16px;z-index:2147483647;width:360px;max-width:calc(100vw - 32px);";
  // Closed shadow root: the host page can't read the panel's contents.
  const root = host.attachShadow({ mode: "closed" });
  document.documentElement.appendChild(host);

  // Working text for the tools + who spoke last (drives the co-pilot reply/follow-up mode).
  let currentSelection = "";
  let lastSpeaker = null; // "agent" | "customer" | null(unknown)

  const MAX_CHARS = 20000;
  const setSelection = (text, who) => {
    currentSelection = String(text || "").slice(0, MAX_CHARS);
    lastSpeaker = who === "agent" || who === "customer" ? who : null;
    const el = root.getElementById("sc-selinfo");
    if (el) {
      const n = currentSelection.trim().length;
      el.textContent = n ? `${n} characters captured` : "No conversation captured yet";
    }
  };

  // Read the open conversation: prefer a per-site adapter (adapters.js), else the user's manual selection.
  function captureConversation() {
    const adapter =
      typeof salesAdapterFor === "function" ? salesAdapterFor(location.hostname) : null;
    if (adapter && typeof adapter.extract === "function") {
      try {
        const text = adapter.extract();
        if (text && text.trim()) {
          setSelection(text, typeof adapter.lastSpeaker === "function" ? adapter.lastSpeaker() : null);
          return;
        }
      } catch {
        /* fall through to manual */
      }
    }
    // Manual selection: highlight the thread, then click Capture. lastSpeaker unknown → server determines it.
    setSelection(window.getSelection ? window.getSelection().toString() : "", null);
  }

  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
    );

  // Render each tool's result shape (mirrors the server return shapes).
  function renderResult(toolKey, data) {
    if (!data) return `<p class="sc-muted">No response.</p>`;
    if (data.error) return `<p class="sc-err">${esc(data.error)}</p>`;

    if (toolKey === "summarize") {
      return data.summary ? `<p>${esc(data.summary)}</p>` : `<p class="sc-muted">Nothing to summarize.</p>`;
    }
    if (toolKey === "dissect") {
      const d = data.dissect || {};
      if (!d.hasSignal) return `<p class="sc-muted">Not enough here to read yet.</p>`;
      const strengths = (d.strengths || [])
        .map((s) => `<li><b>${esc(s.point)}</b> — “${esc(s.excerpt)}”</li>`)
        .join("");
      return `
        ${d.summary ? `<p>${esc(d.summary)}</p>` : ""}
        ${strengths ? `<p class="sc-h">What's working</p><ul>${strengths}</ul>` : ""}
        ${d.opportunity ? `<p class="sc-h">The opportunity</p><p>${esc(d.opportunity)}</p>` : ""}
        ${d.nextMove ? `<p class="sc-h">Next move</p><p>${esc(d.nextMove)}</p>` : ""}
        ${d.guidingQuestion ? `<p class="sc-q">${esc(d.guidingQuestion)}</p>` : ""}`;
    }
    if (toolKey === "coach") {
      const c = data.coaching || {};
      if (!c.hasSignal) return `<p class="sc-muted">Nothing to coach on that draft yet.</p>`;
      const strengths = (c.strengths || []).map((s) => `<li>${esc(s)}</li>`).join("");
      const improvements = (c.improvements || [])
        .map((i) => `<li><b>${esc(i.point)}</b> — ${esc(i.why)}</li>`)
        .join("");
      return `
        ${c.assessment ? `<p>${esc(c.assessment)}</p>` : ""}
        ${strengths ? `<p class="sc-h">Strengths</p><ul>${strengths}</ul>` : ""}
        ${improvements ? `<p class="sc-h">Improve</p><ul>${improvements}</ul>` : ""}
        ${c.suggestedRevision ? `<p class="sc-h">Stronger version</p><p class="sc-rev">${esc(c.suggestedRevision)}</p>` : ""}
        ${c.guidingQuestion ? `<p class="sc-q">${esc(c.guidingQuestion)}</p>` : ""}`;
    }
    // copilot + formulate share { reply, reasoning }
    if (toolKey === "copilot" || toolKey === "formulate") {
      if (!data.reply) return `<p class="sc-muted">Couldn't draft that. Try again.</p>`;
      return `
        <p class="sc-h">Draft</p><p class="sc-rev">${esc(data.reply)}</p>
        ${data.reasoning ? `<p class="sc-q">Move: ${esc(data.reasoning)}</p>` : ""}`;
    }
    return `<pre>${esc(JSON.stringify(data, null, 2))}</pre>`;
  }

  async function runTool(tool, inputValue) {
    const out = root.getElementById("sc-out");
    const token = typeof getToken === "function" ? await getToken() : null;
    if (!token) {
      out.innerHTML = `<p class="sc-muted">Sign in to use the Sales Coach.</p>`;
      chrome.runtime.sendMessage({ type: "open-connect" });
      return;
    }
    if (!currentSelection.trim()) {
      out.innerHTML = `<p class="sc-muted">Highlight the conversation (or open a supported site) and press Capture first.</p>`;
      return;
    }
    out.innerHTML = `<p class="sc-muted">Thinking…</p>`;
    const msg = { type: "sales-tool", endpoint: tool.endpoint, conversation: currentSelection };
    if (tool.input && inputValue) msg[tool.input.key] = inputValue;
    if (lastSpeaker) msg.lastSpeaker = lastSpeaker;
    let resp;
    try {
      resp = await chrome.runtime.sendMessage(msg);
    } catch {
      out.innerHTML = `<p class="sc-err">Couldn't reach the Sales Coach. Try again.</p>`;
      return;
    }
    if (resp && resp.status === 402) {
      out.innerHTML = `<p class="sc-err">${esc(resp.data?.error || "Your plan doesn't include the Sales Coach extension.")}</p>`;
      return;
    }
    if (!resp || resp.status < 200 || resp.status >= 300) {
      out.innerHTML = `<p class="sc-err">${esc(resp?.data?.error || "Something went wrong. Try again.")}</p>`;
      return;
    }
    out.innerHTML = renderResult(tool.key, resp.data);
  }

  // Build the panel UI from SALES_TOOLS.
  const tools = Array.isArray(typeof SALES_TOOLS !== "undefined" ? SALES_TOOLS : null) ? SALES_TOOLS : [];
  const toolButtons = tools
    .map(
      (t, i) =>
        `<button class="sc-tool" data-i="${i}" title="${esc(t.desc)}">${esc(t.label)}</button>`
    )
    .join("");

  root.innerHTML = `
    <style>
      :host { all: initial; }
      .sc-card { font-family: system-ui, sans-serif; background:#0b0b0e; color:#e7e7ea; border:1px solid #2a2a30;
        border-radius:14px; box-shadow:0 10px 40px rgba(0,0,0,.5); overflow:hidden; }
      .sc-hd { display:flex; align-items:center; justify-content:space-between; padding:10px 12px; border-bottom:1px solid #22222a; }
      .sc-title { font-weight:700; font-size:13px; }
      .sc-x { cursor:pointer; color:#9a9aa2; background:none; border:none; font-size:16px; }
      .sc-body { padding:12px; max-height:70vh; overflow:auto; }
      .sc-row { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:8px; }
      .sc-tool { cursor:pointer; font-size:12px; font-weight:600; color:#09090b; background:#f59e0b; border:none; border-radius:8px; padding:6px 9px; }
      .sc-tool:hover { background:#fbbf24; }
      .sc-cap { cursor:pointer; font-size:12px; color:#e7e7ea; background:transparent; border:1px solid #3a3a42; border-radius:8px; padding:6px 9px; }
      .sc-selinfo { font-size:11px; color:#9a9aa2; margin:4px 0 8px; }
      textarea.sc-in { width:100%; box-sizing:border-box; min-height:64px; background:#141418; color:#e7e7ea; border:1px solid #2a2a30; border-radius:8px; padding:8px; font:inherit; font-size:12px; margin-bottom:6px; }
      .sc-run { cursor:pointer; font-size:12px; font-weight:600; color:#09090b; background:#f59e0b; border:none; border-radius:8px; padding:6px 10px; }
      .sc-out { font-size:12.5px; line-height:1.45; }
      .sc-out p { margin:6px 0; } .sc-out ul { margin:6px 0; padding-left:18px; }
      .sc-h { font-weight:700; font-size:11px; text-transform:uppercase; letter-spacing:.04em; color:#f59e0b; margin-top:10px; }
      .sc-q { font-style:italic; color:#c9c9cf; border-left:2px solid #3a3a42; padding-left:8px; }
      .sc-rev { background:#141418; border:1px solid #2a2a30; border-radius:8px; padding:8px; white-space:pre-wrap; }
      .sc-muted { color:#9a9aa2; } .sc-err { color:#fca5a5; }
    </style>
    <div class="sc-card">
      <div class="sc-hd">
        <span class="sc-title">Sales Coach</span>
        <button class="sc-x" id="sc-close" title="Close">✕</button>
      </div>
      <div class="sc-body">
        <div class="sc-row">
          <button class="sc-cap" id="sc-capture">Capture conversation</button>
        </div>
        <div class="sc-selinfo" id="sc-selinfo">No conversation captured yet</div>
        <div class="sc-row" id="sc-tools">${toolButtons}</div>
        <div id="sc-inputwrap"></div>
        <div class="sc-out" id="sc-out"></div>
      </div>
    </div>`;

  root.getElementById("sc-close").addEventListener("click", () => host.remove());
  root.getElementById("sc-capture").addEventListener("click", captureConversation);

  // Tool buttons: input-bearing tools (coach draft, formulate intent) reveal a textarea + Run; the others run
  // straight on the captured conversation.
  root.querySelectorAll(".sc-tool").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tool = tools[Number(btn.dataset.i)];
      const wrap = root.getElementById("sc-inputwrap");
      if (tool.input) {
        wrap.innerHTML = `
          <textarea class="sc-in" id="sc-inval" maxlength="${Number(tool.input.max) || 8000}"
            placeholder="${esc(tool.input.placeholder || "")}"></textarea>
          <button class="sc-run" id="sc-run">${esc(tool.label)}</button>`;
        root.getElementById("sc-run").addEventListener("click", () => {
          runTool(tool, root.getElementById("sc-inval").value);
        });
      } else {
        wrap.innerHTML = "";
        runTool(tool);
      }
    });
  });

  // Auto-capture once on open (best-effort; the rep can re-capture after selecting).
  captureConversation();
})();
