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
  // True when the current text came from an UPLOADED file (not the page). Tools re-capture the page before
  // running (so there's no manual "Capture" button — capture is automatic + fresh), but MUST NOT clobber an
  // upload with the page content, so the re-capture is skipped while this is set.
  let capturedFromUpload = false;
  // MANUAL escape hatch: the page text selection captured at the instant the rep presses a tool button. A click
  // deselects page text, so we snapshot on mousedown (which fires first). If the rep had highlighted something,
  // the tool coaches THAT exact text instead of auto-capturing — the recourse when auto grabs the wrong thing.
  let selectionAtMousedown = "";

  const MAX_CHARS = 20000;
  const setSelection = (text, who) => {
    const raw = String(text || "");
    const wasTrimmed = raw.length > MAX_CHARS; // tell the rep if we truncated — never silently coach on a cut thread (§3.4)
    // Keep the RECENT TAIL, not the oldest head (mirrors the C.A.R.E parent + the adapters): a conversation runs
    // oldest → newest and the tools need the most recent context ("what's the next move" reads the latest turns).
    // Matters most for an UPLOADED long conversation (a full exported chat) — head-trimming would coach on the
    // oldest 20k and drop the recent messages. slice(0,…) was a port-gap from C.A.R.E (which uses slice(-MAX)).
    currentSelection = raw.slice(-MAX_CHARS);
    lastSpeaker = who === "agent" || who === "customer" ? who : null;
    const el = root.getElementById("sc-selinfo");
    if (el) {
      const trimmed = currentSelection.trim();
      const n = trimmed.length;
      if (!n) {
        el.textContent = "No conversation captured yet";
      } else {
        // Show a short preview, not just the count. A Tier-2 adapter selector can match the WRONG nodes and
        // return plausible non-empty garbage (the selectors are reasoned, not runtime-verified). A bare count
        // ("47 characters captured") looks the same for a right grab and a wrong one — so the rep can't tell the
        // panel captured sidebar chrome instead of the thread, and would coach on garbage (the §3.4 honesty rule
        // applied to INPUT: never let the rep act on wrongly-captured context believing it's right). A preview
        // makes a wrong grab self-evident → the rep re-highlights manually (the always-correct path). textContent,
        // so the page's own text can't inject markup.
        const preview = trimmed.replace(/\s+/g, " ").slice(0, 90);
        el.textContent =
          `${n} characters captured${wasTrimmed ? " (trimmed to fit)" : ""} — “${preview}${trimmed.length > 90 ? "…" : ""}”`;
      }
    }
  };

  // Read the open conversation: prefer a per-site adapter (adapters.js), else the universal reader, else the
  // user's manual selection. Always a PAGE capture → clear the upload flag.
  function captureConversation() {
    capturedFromUpload = false;
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
        /* fall through to the universal reader, then manual */
      }
    }
    // No site adapter matched (e.g. Instagram after a markup change, or any unsupported chat site): read the
    // visible conversation generically. This is what makes auto-capture "always work" — the Chrome DOM read is
    // universal; only the targeting was site-specific. lastSpeaker unknown → the server determines it.
    try {
      const uni = typeof universalExtract === "function" ? universalExtract() : "";
      if (uni && uni.trim()) {
        setSelection(uni, null);
        return;
      }
    } catch {
      /* fall through to manual */
    }
    // Last resort: the user's manual highlight (always correct, never fabricated).
    setSelection(window.getSelection ? window.getSelection().toString() : "", null);
  }

  // Upload a conversation FILE (PDF/DOCX/TXT the rep exported from a chat) when the page can't be auto-scanned.
  // The server extracts the text; we then treat it exactly like a captured conversation. A File can't cross
  // chrome.runtime.sendMessage, so we base64 the bytes and the worker rebuilds a multipart upload.
  const UPLOAD_MAX_BYTES = 4 * 1024 * 1024; // mirror the server's 4 MB cap — reject early, before the round-trip
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error || new Error("read failed"));
      reader.onload = () => {
        // readAsDataURL → "data:<mime>;base64,<b64>"; strip the prefix to the bare base64.
        const s = String(reader.result || "");
        const comma = s.indexOf(",");
        resolve(comma >= 0 ? s.slice(comma + 1) : s);
      };
      reader.readAsDataURL(file);
    });
  }
  async function handleUpload(ev) {
    const input = ev.target;
    const file = input && input.files && input.files[0];
    const info = root.getElementById("sc-selinfo");
    if (!file) return;
    if (file.size > UPLOAD_MAX_BYTES) {
      if (info) info.textContent = "That file is larger than 4 MB — upload a smaller file or paste the text.";
      input.value = "";
      return;
    }
    if (info) info.textContent = `Reading “${file.name}”…`;
    let b64;
    try {
      b64 = await fileToBase64(file);
    } catch {
      if (info) info.textContent = "Couldn't read that file.";
      input.value = "";
      return;
    }
    let resp;
    try {
      resp = await chrome.runtime.sendMessage({
        type: "sales-extract",
        endpoint: "/api/coach/extension/extract",
        filename: file.name,
        mime: file.type,
        b64,
      });
    } catch {
      if (info) info.textContent = "Couldn't reach the Sales Coach to read that file.";
      input.value = "";
      return;
    }
    input.value = ""; // let the rep re-upload the same file if needed
    if (resp && resp.status === 401) {
      if (info) info.textContent = "Your session expired — sign in again, then re-upload.";
      chrome.runtime.sendMessage({ type: "open-connect" });
      return;
    }
    if (!resp || resp.status < 200 || resp.status >= 300 || !resp.data || !resp.data.text) {
      if (info) info.textContent = (resp && resp.data && resp.data.error) || "Couldn't read that file.";
      return;
    }
    // Uploaded conversation → lastSpeaker unknown (server determines). setSelection shows the preview + trims.
    setSelection(resp.data.text, null);
    capturedFromUpload = true; // so a tool run won't re-capture the PAGE over this upload
  }

  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
    );

  // Render each tool's result shape (mirrors the server return shapes).
  function renderResult(toolKey, data) {
    if (!data) return `<p class="sc-muted">No response.</p>`;
    if (data.error) return `<p class="sc-err">${esc(data.error)}</p>`;

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
    // Suggested Response returns { reply, reasoning }. The reply is the copyable, customer-facing output; the
    // "Move" reasoning is an internal note shown but DELIBERATELY excluded from the copy so it never lands in the
    // prospect's inbox (mirrors the C.A.R.E panel — copying out is the workflow-continuity step).
    if (toolKey === "suggested") {
      if (!data.reply) return `<p class="sc-muted">Couldn't draft a suggested response. Try again.</p>`;
      return `
        <div class="sc-rhead"><span class="sc-h">Suggested response</span><button class="sc-copy" id="sc-copy">Copy</button></div>
        <p class="sc-rev">${esc(data.reply)}</p>
        ${data.reasoning ? `<p class="sc-q">Move: ${esc(data.reasoning)}</p>` : ""}`;
    }
    return `<pre>${esc(JSON.stringify(data, null, 2))}</pre>`;
  }

  // The copyable, customer-facing text for a result (or "" if none). Held in a JS closure and passed to
  // wireCopy — never placed in an HTML attribute, so quotes in the draft can't break escaping. The "Move"
  // reasoning is intentionally NOT copyable (internal note only).
  function copyTextFor(toolKey, data) {
    if (!data) return "";
    if (toolKey === "suggested" && typeof data.reply === "string") return data.reply;
    return "";
  }

  // Wire the result's Copy button. navigator.clipboard can throw (page blocks it / not focused) — guard it and
  // fall back to a "select + Ctrl+C" hint; the text stays selectable either way. (browser-APIs-that-throw lens.)
  function wireCopy(out, text) {
    const btn = out.querySelector("#sc-copy");
    if (!btn || !text) return;
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = "Copied ✓";
        setTimeout(() => { btn.textContent = "Copy"; }, 1500);
      } catch {
        btn.textContent = "Press Ctrl+C";
      }
    });
  }

  async function runTool(tool, inputValue) {
    const out = root.getElementById("sc-out");
    const token = typeof getToken === "function" ? await getToken() : null;
    if (!token) {
      // Signed-out state: an explicit Sign-in button (not just text) so the rep can (re)connect if the connect
      // tab was closed or the handoff failed — the auto-open below covers the happy path, the button the retry.
      // The one-line explanation names what sign-in is for (transparency for a conversation-reading tool).
      out.innerHTML =
        `<p class="sc-muted">Sign in with your account to coach the conversation on this page — after you sign in, come back to this tab.</p>` +
        `<button class="sc-run" id="sc-signin">Sign in</button>`;
      const signinBtn = root.getElementById("sc-signin");
      if (signinBtn) signinBtn.addEventListener("click", () => chrome.runtime.sendMessage({ type: "open-connect" }));
      chrome.runtime.sendMessage({ type: "open-connect" });
      return;
    }
    // Capture for this run (no manual Capture button): if the rep HIGHLIGHTED text, coach exactly that (the
    // manual escape hatch); otherwise refresh the PAGE read so the tool acts on the CURRENT conversation. Skip
    // entirely when the rep uploaded a file, so we don't clobber their upload.
    if (!capturedFromUpload) {
      if (selectionAtMousedown) setSelection(selectionAtMousedown, null);
      else captureConversation();
    }
    if (!currentSelection.trim()) {
      out.innerHTML = `<p class="sc-muted">Couldn't read the conversation on this page. Highlight the thread, or use “Upload conversation”.</p>`;
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
    if (resp && resp.status === 401) {
      // Session expired AND the worker's silent refresh failed (it cleared the token). "Try again" wouldn't
      // help — the rep needs to re-authenticate, so say that and give the button, not a generic error.
      out.innerHTML =
        `<p class="sc-muted">Your session expired. Sign in again to keep coaching.</p>` +
        `<button class="sc-run" id="sc-signin">Sign in</button>`;
      const signinBtn = root.getElementById("sc-signin");
      if (signinBtn) signinBtn.addEventListener("click", () => chrome.runtime.sendMessage({ type: "open-connect" }));
      return;
    }
    if (!resp || resp.status < 200 || resp.status >= 300) {
      // Surface the REAL cause: our routes return { error } for handled failures; a framework 500/504 has no
      // such field, so show the status (+ any non-JSON body snippet) instead of a generic message, and log the
      // full response so DevTools has it. (§3.4 honesty — don't hide the failure behind "something went wrong".)
      // eslint-disable-next-line no-console
      console.error("[sales-coach] tool request failed:", tool.endpoint, "→ HTTP", resp?.status, resp?.data);
      const detail =
        resp?.data?.error ||
        (resp?.data?._nonjson ? `HTTP ${resp?.status}: ${resp.data._nonjson}` : `HTTP ${resp?.status ?? "no response"}`);
      out.innerHTML = `<p class="sc-err">Request failed — ${esc(detail)}. Try again.</p>`;
      return;
    }
    out.innerHTML = renderResult(tool.key, resp.data);
    wireCopy(out, copyTextFor(tool.key, resp.data));
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
      .sc-rhead { display:flex; align-items:center; justify-content:space-between; margin-top:10px; }
      .sc-rhead .sc-h { margin-top:0; }
      .sc-copy { font-size:10px; font-weight:600; color:#a1a1aa; background:transparent; border:1px solid #2a2a30; border-radius:6px; padding:2px 8px; cursor:pointer; }
      .sc-copy:hover { color:#fafafa; border-color:#3a3a42; }
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
          <button class="sc-cap" id="sc-upload" title="Upload a PDF/DOCX/TXT export of the conversation">Upload conversation</button>
          <input type="file" id="sc-file" accept=".pdf,.txt,.docx,.md" style="display:none" />
        </div>
        <div class="sc-selinfo" id="sc-selinfo">Reading the conversation…</div>
        <div class="sc-row" id="sc-tools">${toolButtons}</div>
        <div id="sc-inputwrap"></div>
        <div class="sc-out" id="sc-out"></div>
      </div>
    </div>`;

  root.getElementById("sc-close").addEventListener("click", () => host.remove());
  // Upload conversation: a hidden file input opened by the button; the change handler does the extract round-trip.
  root.getElementById("sc-upload").addEventListener("click", () => root.getElementById("sc-file").click());
  root.getElementById("sc-file").addEventListener("change", handleUpload);
  // Snapshot the rep's PAGE selection the instant they press ANY panel button (mousedown fires before the click
  // clears the page selection), so a tool can coach exactly what they highlighted (the manual escape hatch).
  root.addEventListener(
    "mousedown",
    () => {
      try {
        const s = (window.getSelection ? window.getSelection().toString() : "") || "";
        selectionAtMousedown = s.trim().length >= 20 ? s : "";
      } catch {
        selectionAtMousedown = "";
      }
    },
    true
  );

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
        const inval = root.getElementById("sc-inval");
        if (inval) inval.focus(); // auto-focus so the rep types immediately, no extra click (C.A.R.E parity)
        root.getElementById("sc-run").addEventListener("click", () => {
          // A REQUIRED-input tool must not fire on empty (the server would 400 on the missing field → confusing
          // "something went wrong") — refocus instead. An OPTIONAL input (Suggested Response's guidance) IS
          // allowed empty: a blank Run means "draft from the conversation", which the server handles.
          const ta = root.getElementById("sc-inval");
          const v = ((ta && ta.value) || "").trim();
          if (!v && !tool.input.optional) { if (ta) ta.focus(); return; }
          runTool(tool, v);
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
