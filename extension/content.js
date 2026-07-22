// C.A.R.E extension — on-page panel (content script).
//
// WHY this exists (founder feedback, 2026-07-22): the browser-action POPUP auto-closes the moment you click
// the page — which is fatal here, because using the tools means selecting text ON the page. A popup can't be
// "minimizable" or "not auto-close" (that's inherent to popups). So the UI is an injected in-page panel that:
//   • stays open until you close it (does not auto-close),
//   • minimizes to a small floating bubble,
//   • has an explicit ✕ close button.
//
// Injected via chrome.scripting.executeScript(["config.js","adapters.js","content.js"]) from the background
// worker on the toolbar-icon click, sharing their isolated-world globals (getApiBase/getToken/CARE_TOOLS from
// config.js; careAdapterFor from adapters.js). Network calls go through the worker (CORS) — see runTool.
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
  // Resolved from getApiBase() on each render(); used to link the Spawn draft back to the workspace so the tool
  // doesn't dead-end (§1.5.1 workflow continuity). Safe default until the first render resolves it.
  let apiBase = "https://elostate.com";

  // ── Shadow host ──────────────────────────────────────────────────────────────────────────────────────────
  const host = document.createElement("div");
  host.id = HOST_ID;
  // Fixed, top-right, above almost everything. The host is a positioning shell; the panel lives in the shadow.
  host.style.cssText =
    "position:fixed;top:16px;right:16px;z-index:2147483646;width:auto;height:auto;margin:0;padding:0;";
  // mode:"closed" so the host page can't read the panel's contents via host.shadowRoot (the rendered output is
  // C.A.R.E analysis the page never had). We keep our own `root` reference regardless.
  const root = host.attachShadow({ mode: "closed" });
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
    .ghost { width:100%; margin-top:8px; border:1px solid rgba(255,255,255,0.14); border-radius:10px;
      background:transparent; color:#e4e4e7; font-weight:600; font-size:12.5px; padding:9px; cursor:pointer; }
    .ghost:hover { background:rgba(255,255,255,0.05); border-color:rgba(255,255,255,0.24); }
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
    .rhead { display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
    .rlabel { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.09em; color:#FACC15; }
    .copybtn { font-size:10px; font-weight:600; color:#a1a1aa; background:transparent; border:1px solid rgba(255,255,255,0.14);
      border-radius:6px; padding:2px 8px; cursor:pointer; }
    .copybtn:hover { color:#fafafa; border-color:rgba(255,255,255,0.3); }
    /* Tool input (Coach draft / Formulate intent) + rich result rendering */
    .ilabel { display:block; font-size:11px; color:#a1a1aa; margin:2px 0 6px; }
    .tinput { width:100%; min-height:72px; resize:vertical; font-family:inherit; font-size:12.5px; line-height:1.5;
      color:#fafafa; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.12); border-radius:9px;
      padding:9px 10px; margin-bottom:9px; }
    .tinput:focus { outline:none; border-color:rgba(250,204,21,0.5); }
    .rnote { font-size:11px; line-height:1.5; color:#a1a1aa; margin-top:8px; white-space:pre-wrap; }
    .cbadge { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.07em; padding:2px 7px;
      border-radius:999px; margin-right:auto; }
    .cb-correct { background:rgba(34,197,94,0.15); color:#4ade80; }
    .cb-unclear { background:rgba(250,204,21,0.15); color:#FACC15; }
    .cb-unproductive, .cb-negative { background:rgba(248,113,113,0.15); color:#f87171; }
    .csug { margin-top:8px; padding:9px 10px; border-radius:8px; background:rgba(250,204,21,0.06);
      border:1px solid rgba(250,204,21,0.18); color:#fafafa; white-space:pre-wrap; }
    .cprin { font-size:10.5px; color:#71717a; margin-top:8px; font-style:italic; }
    .ttitle { font-weight:700; font-size:13.5px; color:#fafafa; margin-bottom:2px; }
    .tsteps { margin:8px 0 0; padding-left:18px; font-size:12px; line-height:1.5; color:#e4e4e7; }
    .tsteps li { margin-bottom:3px; }
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

  // ── Tool run ─────────────────────────────────────────────────────────────────────────────────────────────
  // The actual network call happens in the background worker (chrome.runtime.sendMessage → "care-tool"), NOT
  // here: a content-script fetch is subject to CORS and would be refused by elostate.com on every host site.
  // The worker holds the token, calls the API, and does the silent refresh + retry. We just render its result.
  // runTool(tool, inputValue): inputValue is the agent's own text for tools that need it (Coach: a draft to
  // grade; Formulate: an intent to shape). For those tools, the first call (inputValue undefined) renders an
  // input form; its Run button re-invokes runTool with the typed value. The other tools run on the selection.
  async function runTool(tool, inputValue) {
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
    // Tools that grade/shape the AGENT's OWN words ask for them first (Coach: draft, Formulate: intent).
    if (tool.input && inputValue == null) {
      renderInputForm(out, tool);
      return;
    }
    out.innerHTML = `<div class="rlabel">${esc(tool.label)}</div><span class="spin"></span>Running…`;

    let resp;
    try {
      const msg = { type: "care-tool", endpoint: tool.endpoint, conversation: currentSelection };
      if (tool.input && inputValue) msg[tool.input.key] = inputValue;
      resp = await chrome.runtime.sendMessage(msg);
    } catch {
      out.innerHTML = `<div class="rlabel">${esc(tool.label)}</div>Couldn't reach C.A.R.E. Check your connection.`;
      return;
    }
    if (!resp) {
      out.innerHTML = `<div class="rlabel">${esc(tool.label)}</div>Couldn't reach C.A.R.E.`;
      return;
    }

    const { status, data = {} } = resp;
    if (status === 401) {
      // The worker already tried a silent refresh and cleared the session if it truly expired.
      out.innerHTML = `<div class="rlabel">${esc(tool.label)}</div>Your session expired. Click Sign in to reconnect.`;
      setTimeout(render, 600);
      return;
    }
    if (status === 402) {
      const s = data?.entitlement?.status || "locked";
      out.innerHTML = `<div class="rlabel">${esc(tool.label)}</div>Your plan doesn't include the C.A.R.E extension (${esc(s)}). Upgrade to Pro or start a trial in your workspace.`;
      return;
    }
    if (status < 200 || status >= 300) {
      out.innerHTML = `<div class="rlabel">${esc(tool.label)}</div>${esc(data?.error || "Something went wrong.")}`;
      return;
    }

    // §3.4 control window (Spawn during a team's month-1 baseline) — honest, not an error.
    if (data.suppressed) {
      renderResult(out, tool.label, data.message || "This tool is in your team's month-1 control window right now.");
      return;
    }
    if (data.dissect) {
      const d = data.dissect;
      const text = d.hasSignal
        ? `PROBLEM: ${d.problem?.statement || ""}\nWhy it matters: ${d.problem?.whyItMatters || ""}\n\n` +
          `ROOT CAUSE: ${d.rootCause || ""}\n\nOUTSIDE VIEW: ${d.outsideView || ""}\n\n` +
          `GUIDING QUESTION: ${d.guidingQuestion || ""}`
        : "Not enough in the selected text to dissect a clear problem yet — select more of the conversation.";
      renderResult(out, tool.label, text);
    } else if (data.coach) {
      renderCoach(out, tool.label, data.coach);
    } else if (data.task) {
      renderTask(out, tool.label, data.task);
    } else if (typeof data.reply === "string" && data.reply) {
      // Co-Pilot / Formulate: the customer-facing reply is the copyable output; the "move" reasoning is an
      // internal note shown below and DELIBERATELY excluded from the copy so it never lands in the customer's inbox.
      renderResult(out, tool.label, data.reply, data.reasoning ? `<div class="rnote">Move: ${esc(data.reasoning)}</div>` : "");
    } else {
      renderResult(out, tool.label, data.summary || data.result || JSON.stringify(data, null, 2));
    }
  }

  // Input form for tools that need the agent's own words. Run is disabled logic is simple: empty → refocus.
  function renderInputForm(out, tool) {
    const inp = tool.input;
    out.innerHTML =
      `<div class="rlabel">${esc(tool.label)}</div>` +
      `<label class="ilabel">${esc(inp.label)}</label>` +
      `<textarea class="tinput" id="toolInput" rows="4" placeholder="${esc(inp.placeholder)}"></textarea>` +
      `<button class="primary" id="toolRun">Run ${esc(tool.label)}</button>`;
    const ta = out.querySelector("#toolInput");
    const runBtn = out.querySelector("#toolRun");
    if (ta) ta.focus();
    if (runBtn) runBtn.addEventListener("click", () => {
      const v = ((ta && ta.value) || "").trim();
      if (!v) { if (ta) ta.focus(); return; }
      runTool(tool, v);
    });
  }

  // Render a plain-text result with a Copy button (the copy is `copyText`); `extraHtml` is appended as an
  // internal note that is shown but NOT copied. After a result the agent's next move is to paste it into their
  // reply — copying out is the workflow-continuity step (§1.5.1).
  function renderResult(out, label, copyText, extraHtml) {
    out.innerHTML =
      `<div class="rhead"><span class="rlabel">${esc(label)}</span>` +
      `<button class="copybtn" id="copyResult">Copy</button></div>${esc(copyText)}` +
      (extraHtml || "");
    wireCopy(out, copyText);
  }

  // Coach review (grade a draft vs the books): classification badge + affirmation, and when flagged a copyable
  // suggested revision with the book-grounded WHY. The copyable text is the revision — the agent's next move is
  // to send it; if nothing needs improving, the affirmation is copyable so the panel always has a Copy target.
  function renderCoach(out, label, coach) {
    const cls = String(coach.classification || "");
    // The classification goes into a CLASS ATTRIBUTE below. esc() escapes <&> but NOT quotes, so it is not
    // sufficient for attribute context. The server validator already allowlists classification to these four,
    // but the panel must not RELY on that gate for its own safety — map to a known suffix here so nothing
    // unexpected can ever reach the attribute (defence in depth). The visible text still shows esc(cls).
    const KNOWN_CLASS = new Set(["correct", "unclear", "unproductive", "negative"]);
    const clsSuffix = KNOWN_CLASS.has(cls) ? cls : "";
    const imp = coach.needsImprovement && coach.improvement ? coach.improvement : null;
    const copyText = imp ? String(imp.suggestedRevision || "") : String(coach.affirmation || "Reads well — no change suggested.");
    let body = "";
    if (coach.affirmation) body += `<div class="rnote">${esc(coach.affirmation)}</div>`;
    if (imp) {
      body += `<div class="csug">${esc(imp.suggestedRevision || "")}</div>`;
      if (imp.whyContext) body += `<div class="rnote">${esc(imp.whyContext)}</div>`;
      if (imp.whySentence) body += `<div class="rnote">${esc(imp.whySentence)}</div>`;
      const p = imp.principleCited;
      if (p && p.name) {
        body += `<div class="cprin">${esc(p.name)}${p.book ? ` — ${esc(p.book)}` : ""}${p.sectionRef ? ` (${esc(p.sectionRef)})` : ""}</div>`;
      }
    }
    out.innerHTML =
      `<div class="rhead"><span class="rlabel">${esc(label)}</span>` +
      `<span class="cbadge cb-${clsSuffix}">${esc(cls || "reviewed")}</span>` +
      `<button class="copybtn" id="copyResult">Copy</button></div>` + body;
    wireCopy(out, copyText);
  }

  // Spawn task result — a DRAFT (not yet persisted, §3.3): title + description + numbered steps, copyable as a
  // block. The agent finalizes it in their C.A.R.E workspace (the honest boundary — see the spawn route header).
  function renderTask(out, label, task) {
    const steps = Array.isArray(task.steps) ? task.steps : [];
    const stepsHtml = steps.map((s) => `<li>${esc(String(s))}</li>`).join("");
    const copyText =
      `${task.title || ""}\n\n${task.description || ""}\n\n` +
      steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
    out.innerHTML =
      `<div class="rhead"><span class="rlabel">${esc(label)} — draft</span>` +
      `<button class="copybtn" id="copyResult">Copy</button></div>` +
      `<div class="ttitle">${esc(String(task.title || ""))}</div>` +
      `<div class="rnote">${esc(String(task.description || ""))}</div>` +
      (stepsHtml ? `<ol class="tsteps">${stepsHtml}</ol>` : "") +
      `<div class="rnote">Draft only — copy it, then finish creating it in C.A.R.E: ` +
      `<a class="link" href="${esc(apiBase)}/dashboard/operations" target="_blank" rel="noopener noreferrer">Open C.A.R.E →</a></div>`;
    wireCopy(out, copyText);
  }

  // Wire the Copy button in a rendered result to copy `text` (never the internal notes).
  function wireCopy(out, text) {
    const btn = out.querySelector("#copyResult");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = "Copied ✓";
        setTimeout(() => { btn.textContent = "Copy"; }, 1500);
      } catch {
        btn.textContent = "Press Ctrl+C"; // some pages block programmatic clipboard; the text is selectable
      }
    });
  }

  // Set the working text (from a manual selection or a per-site adapter) and reflect it in the UI.
  function setSelection(text, note) {
    currentSelection = (text || "").trim();
    const info = $("selInfo");
    if (info) {
      info.textContent = currentSelection
        ? `Read ${currentSelection.length.toLocaleString()} characters. Pick a tool.`
        : note || "Nothing selected — highlight the conversation on the page, then click again.";
    }
    root.querySelectorAll(".tool[data-endpoint]").forEach((b) => { b.disabled = !currentSelection; });
  }

  function readSelection() {
    setSelection(window.getSelection ? window.getSelection().toString() : "", null);
  }

  // Per-site adapter: pull the open conversation from the DOM. Empty result → tell the user to select manually
  // (§3.4 — never fabricate; degrade to the universal path).
  function readAdapter(adapter) {
    const text = adapter.extract();
    setSelection(
      text,
      `Couldn't auto-read this ${adapter.label} — highlight it on the page and use “Read my selected text”.`
    );
  }

  // ── Views ────────────────────────────────────────────────────────────────────────────────────────────────
  function toolsView() {
    const grid = CARE_TOOLS.map((t, i) => {
      const soon = t.endpoint ? "" : `<span class="soon">SOON</span>`;
      const dis = t.endpoint ? "" : "disabled";
      return `<button class="tool" data-i="${i}" ${t.endpoint ? 'data-endpoint="1"' : ""} ${dis}>
        <span class="t-label">${esc(t.label)}${soon}</span><span class="t-desc">${esc(t.desc)}</span></button>`;
    }).join("");
    // On a known platform, offer one-click "Read this <thread>" (adapter); everywhere else, selection only.
    const adapter = typeof careAdapterFor === "function" ? careAdapterFor(location.hostname) : null;
    const adapterBtn = adapter
      ? `<button class="primary" id="readAdapterBtn">Read this ${esc(adapter.label)}</button>
         <button class="ghost" id="readSelBtn">Read my selected text instead</button>`
      : `<button class="primary" id="readSelBtn">Read my selected text</button>`;
    $("body").innerHTML = `
      <div class="consent">We only read the ${adapter ? "conversation you point us at" : "text you have <b>selected</b>"} on the page. It's processed to help you and <b>not stored</b>.</div>
      ${adapterBtn}
      <div class="selinfo" id="selInfo">${adapter ? `Click above to read the open ${esc(adapter.label)}, or highlight part of it.` : "Highlight a conversation on the page, then click above."}</div>
      <div class="grid">${grid}</div>
      <div class="result hide" id="result"></div>`;
    if (adapter) $("readAdapterBtn").addEventListener("click", () => readAdapter(adapter));
    // Capture on mousedown + preventDefault so clicking the button doesn't steal focus and COLLAPSE the page
    // selection before we read it (the classic rich-text-toolbar problem). Without this, "Read my selected
    // text" would often read empty on the very flow it exists for.
    $("readSelBtn").addEventListener("mousedown", (e) => {
      e.preventDefault();
      readSelection();
    });
    root.querySelectorAll(".tool").forEach((btn) => {
      btn.addEventListener("click", () => runTool(CARE_TOOLS[Number(btn.dataset.i)]));
    });
    // Start empty on adapter sites (the user chooses which to read); on generic sites, seed from any selection.
    if (adapter) setSelection("", `Click above to read the open ${adapter.label}, or highlight part of it.`);
    else readSelection();
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
    apiBase = base;
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
